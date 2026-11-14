/**
 * ipax-backdrop / 3200-kernel-webgl.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 3 - KERNEL, WebGL backend. Same contract as the CPU backend
 * (3000-kernel.js), computed by the fragment shader in 3210.
 *
 * ONE shared WebGL context: browsers cap contexts per page, so every managed
 * element renders in turn into the same hidden canvas, and the caller copies
 * the result into the element's own layer right away.
 *
 * What goes to the GPU: the backdrop estimate (texture), the unknown-cell grid
 * (texture) and a handful of uniforms. Nothing is read back, so there are no
 * contrast statistics on this backend (stats = null).
 *
 * PERFORMANCE (v0.1.05) - nothing is reallocated while sizes vary
 *   - The drawing buffer only GROWS (rounded up to 64 px). Each render draws into its
 *     lower-left w x h corner (gl.viewport) and returns result.srcRect, the
 *     rectangle of the canvas that holds the pixels (GL origin is bottom-left, so
 *     srcRect.y = canvasHeight - h). compositor.draw() copies only that rectangle.
 *     REQUIRES the v0.1.05 4000-compositor.js (srcRect support).
 *   - The estimate, blur and grid textures also only grow. Content is uploaded with
 *     texSubImage2D into the corner and the shader scales the UVs (uTexSize, uGridTex).
 *   - The unknown grid V (already 0/1 bytes) is uploaded directly: no per-render copy.
 *   - Samplers, vertex attribute, pixel-store state and the program are set once.
 *   - Uniform arrays are preallocated.
 *   - gl.getError() is a synchronous round trip to the GPU process, so it only runs on
 *     the first renders and then every 16th. Context loss is caught by its event.
 *
 * Availability checks (any failure marks the backend unavailable and the
 * dispatcher falls back to the CPU kernel): context creation (software
 * renderers are refused), highp floats in fragment shaders, shader
 * compilation and linking, any GL error after a draw, and context loss.
 * A lost context that is later restored makes the backend available again.
 *
 * Service 'ipax-backdrop:kernel-webgl': available(), render(input),
 *   disable(reason), reason(), reset()
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);
	const UNIFORMS = ['uEst', 'uEstBlur', 'uHasBlur', 'uGrid', 'uSize', 'uTexSize', 'uGridTex', 'uDim', 'uScale', 'uFeather', 'uGridInfo', 'uHasEst', 'uTri', 'uRatioS', 'uBypass', 'uBand', 'uTriVeil', 'uRunCount', 'uRun', 'uYT', 'uPk', 'uAl', 'uVc'];
	const ALIGN = 64;
	const up = (v, a) => Math.ceil(v / (a || ALIGN)) * (a || ALIGN);

	function freshState() {
		return {
			canvas: null, gl: null, prog: null, loc: null, texEst: null, texGrid: null, texBlur: null, buf: null, aPos: -1,
			broken: false, why: '',
			cw: 0, ch: 0,   // drawing buffer size
			tw: 0, th: 0,   // estimate texture size (allocated)
			bw: 0, bh: 0,   // blur texture size (allocated)
			gw: 0, gh: 0,   // grid texture size (allocated)
			maxDim: 0, n: 0,
			yT: null, pk: null, al: null, vc: null, rect: null,
			srcRect: { x: 0, y: 0, w: 0, h: 0 }
		};
	}
	const state = freshState();

	function fail(why) { state.broken = true; state.why = why; state.gl = null; return false; }

	function compile(gl, type, src) {
		const sh = gl.createShader(type);
		gl.shaderSource(sh, src);
		gl.compileShader(sh);
		if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
			const log = gl.getShaderInfoLog(sh);
			gl.deleteShader(sh);
			throw new Error('shader compile failed: ' + log);
		}
		return sh;
	}

	/** Creates a texture and binds it to the CURRENT texture unit. */
	function makeTexture(gl) {
		const t = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, t);
		// NPOT-safe settings: clamp, no mipmaps, nearest.
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		return t;
	}

	function init() {
		if (state.gl) return true;
		if (state.broken) return false;
		try {
			const canvas = document.createElement('canvas');
			canvas.width = 1; canvas.height = 1;
			const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, failIfMajorPerformanceCaveat: true });
			if (!gl) return fail('no WebGL context (unsupported or software renderer)');
			const pf = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
			if (!pf || pf.precision < 23) return fail('highp float is not supported in fragment shaders');

			const Sh = svc('webgl-shaders'), maxRuns = svc('limits').maxRuns, maxC = maxRuns + 1;
			const prog = gl.createProgram();
			gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, Sh.vertex));
			gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, Sh.fragment(maxRuns)));
			gl.linkProgram(prog);
			if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('program link failed: ' + gl.getProgramInfoLog(prog));

			const loc = {};
			UNIFORMS.forEach((n) => { loc[n] = gl.getUniformLocation(prog, n) || gl.getUniformLocation(prog, n + '[0]'); });

			// One-time state: program, samplers, geometry, pixel storage.
			gl.useProgram(prog);
			gl.uniform1i(loc.uEst, 0);
			gl.uniform1i(loc.uGrid, 1);
			gl.uniform1i(loc.uEstBlur, 2);
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
			gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
			gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

			const buf = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, buf);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
			const aPos = gl.getAttribLocation(prog, 'aPos');
			gl.enableVertexAttribArray(aPos);
			gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

			canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fail('WebGL context lost'); }, false);
			canvas.addEventListener('webglcontextrestored', () => { state.broken = false; state.why = ''; state.canvas = null; state.gl = null; }, false);

			// Fresh size bookkeeping: the new context has no allocated storage.
			state.cw = state.ch = state.tw = state.th = state.bw = state.bh = state.gw = state.gh = 0;
			const mvd = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
			state.maxDim = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), mvd[0], mvd[1]);
			state.yT = new Float32Array(maxC); state.pk = new Float32Array(maxC);
			state.al = new Float32Array(maxC); state.vc = new Float32Array(maxC);
			state.rect = new Float32Array(maxRuns * 4);

			state.canvas = canvas; state.gl = gl; state.prog = prog; state.loc = loc; state.buf = buf; state.aPos = aPos;
			gl.activeTexture(gl.TEXTURE0); state.texEst = makeTexture(gl);
			gl.activeTexture(gl.TEXTURE1); state.texGrid = makeTexture(gl);
			gl.activeTexture(gl.TEXTURE2); state.texBlur = makeTexture(gl);
			return true;
		} catch (err) {
			return fail(String(err && err.message || err));
		}
	}

	function render(input) {
		if (!init()) throw new Error(state.why || 'WebGL unavailable');
		const K = svc('contrast'), maxRuns = svc('limits').maxRuns;
		const { est, estBlur, grid, w, h, s, W, H, params, colors } = input;
		const gl = state.gl, L = state.loc, maxDim = state.maxDim;
		if (w > maxDim || h > maxDim || grid.nx > maxDim || grid.ny > maxDim) throw new Error('working size ' + w + 'x' + h + ' exceeds the GPU limit ' + maxDim);

		// 1. Drawing buffer: only grows. Changing canvas.width/height reallocates it, so it is avoided.
		if (w > state.cw || h > state.ch) {
			state.cw = Math.min(maxDim, Math.max(state.cw, up(w)));
			state.ch = Math.min(maxDim, Math.max(state.ch, up(h)));
			state.canvas.width = state.cw; state.canvas.height = state.ch;
		}
		gl.viewport(0, 0, w, h);

		// 2. Estimate texture: allocated once per growth, filled with texSubImage2D.
		if (w > state.tw || h > state.th) {
			state.tw = Math.min(maxDim, Math.max(state.tw, up(w)));
			state.th = Math.min(maxDim, Math.max(state.th, up(h)));
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, state.texEst);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, state.tw, state.th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
			state.bw = 0; state.bh = 0; // the blur texture must match the new size
		}
		// A tainted canvas throws SecurityError: veil only.
		let hasEst = 0, tainted = false;
		if (est) {
			try {
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, state.texEst);
				gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, est);
				hasEst = 1;
			} catch (e) { tainted = true; }
		}

		// 3. Blurred estimate -> texture unit 2 (same allocated size as the estimate).
		let hasBlur = 0;
		if (estBlur && !tainted) {
			try {
				gl.activeTexture(gl.TEXTURE2);
				gl.bindTexture(gl.TEXTURE_2D, state.texBlur);
				if (state.bw !== state.tw || state.bh !== state.th) {
					gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, state.tw, state.th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
					state.bw = state.tw; state.bh = state.th;
				}
				gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, estBlur);
				hasBlur = 1;
			} catch (e) { } // silent fail, falls back to sharp
		}

		// 4. Unknown cells -> texture unit 1. V is already 0/1 bytes; the shader multiplies by 255.
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, state.texGrid);
		if (grid.nx > state.gw || grid.ny > state.gh) {
			state.gw = Math.min(maxDim, Math.max(state.gw, up(grid.nx, 16)));
			state.gh = Math.min(maxDim, Math.max(state.gh, up(grid.ny, 16)));
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, state.gw, state.gh, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, null);
		}
		gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, grid.nx, grid.ny, gl.LUMINANCE, gl.UNSIGNED_BYTE, grid.V);

		// 5. Per-colour parameters come from the shared contrast utilities.
		const rS = K.solveRatio(params.ratio), tri = params.mode === 'tricontrast';
		const runs = colors.runs.length > maxRuns ? colors.runs.slice(0, maxRuns) : colors.runs;
		const pcs = [K.prepareColor(colors.base, rS)];
		for (let i = 0; i < runs.length; i++) pcs.push(K.prepareColor(runs[i].c, rS));
		const yT = state.yT, pk = state.pk, al = state.al, vc = state.vc, rect = state.rect;
		for (let i = 0; i < pcs.length; i++) { const p = pcs[i]; yT[i] = p.yT; pk[i] = p.pkL; al[i] = p.al; vc[i] = p.vc / 255; }
		for (let i = 0; i < runs.length; i++) { const r = runs[i]; rect[i * 4] = r.x0; rect[i * 4 + 1] = r.y0; rect[i * 4 + 2] = r.x1; rect[i * 4 + 3] = r.y1; }
		const band = K.band(params.ratio), tv = K.bandVeil(band);

		gl.uniform1f(L.uHasBlur, hasBlur);
		gl.uniform2f(L.uSize, w, h);
		gl.uniform2f(L.uTexSize, state.tw, state.th);
		gl.uniform2f(L.uGridTex, state.gw, state.gh);
		gl.uniform2f(L.uDim, W, H);
		gl.uniform1f(L.uScale, s);
		const fParam = params.feather;
		const f = (typeof fParam === 'number')
			? { top: fParam, right: fParam, bottom: fParam, left: fParam }
			: (fParam || { top: 0, right: 0, bottom: 0, left: 0 });
		gl.uniform4f(L.uFeather, f.top || 0, f.right || 0, f.bottom || 0, f.left || 0);
		gl.uniform3f(L.uGridInfo, grid.nx, grid.ny, grid.g);
		gl.uniform1f(L.uHasEst, hasEst);
		gl.uniform1f(L.uTri, tri ? 1 : 0);
		gl.uniform1f(L.uRatioS, rS);
		gl.uniform1f(L.uBypass, K.isBypass(params.ratio) ? 1 : 0);
		gl.uniform2f(L.uBand, band.lo, band.hi);
		gl.uniform2f(L.uTriVeil, tv.al, tv.vc / 255);
		gl.uniform1i(L.uRunCount, runs.length);
		gl.uniform4fv(L.uRun, rect);
		gl.uniform1fv(L.uYT, yT);
		gl.uniform1fv(L.uPk, pk);
		gl.uniform1fv(L.uAl, al);
		gl.uniform1fv(L.uVc, vc);

		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

		// getError is synchronous: first renders, then every 16th.
		if (state.n++ < 4 || (state.n & 15) === 0) {
			const err = gl.getError();
			if (err !== gl.NO_ERROR) throw new Error('WebGL error 0x' + err.toString(16));
		}

		// The result sits in the lower-left w x h corner of the buffer. In bitmap coordinates (origin top-left) that is y = ch - h.
		const sr = state.srcRect;
		sr.x = 0; sr.y = state.ch - h; sr.w = w; sr.h = h;
		return { source: state.canvas, srcRect: sr, stats: null, tainted };
	}

	window.j0.register('ipax-backdrop:kernel-webgl', {
		available: init,
		render,
		disable: fail,
		reason: () => state.why,
		reset: () => { state.broken = false; state.why = ''; state.gl = null; state.canvas = null; }
	});
})();
