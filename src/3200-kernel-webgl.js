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
	const UNIFORMS = ['uEst', 'uGrid', 'uSize', 'uDim', 'uScale', 'uFeather', 'uGridInfo', 'uHasEst', 'uTri', 'uRatioS', 'uBand', 'uTriVeil', 'uRunCount', 'uRun', 'uYT', 'uPk', 'uAl', 'uVc'];
	const state = { canvas: null, gl: null, prog: null, loc: null, texEst: null, texGrid: null, buf: null, aPos: -1, broken: false, why: '' };

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

			const Sh = svc('webgl-shaders');
			const prog = gl.createProgram();
			gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, Sh.vertex));
			gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, Sh.fragment(svc('limits').maxRuns)));
			gl.linkProgram(prog);
			if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('program link failed: ' + gl.getProgramInfoLog(prog));

			const loc = {};
			UNIFORMS.forEach((n) => { loc[n] = gl.getUniformLocation(prog, n) || gl.getUniformLocation(prog, n + '[0]'); });
			const buf = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, buf);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

			canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fail('WebGL context lost'); }, false);
			canvas.addEventListener('webglcontextrestored', () => { state.broken = false; state.why = ''; state.canvas = null; state.gl = null; }, false);

			state.canvas = canvas; state.gl = gl; state.prog = prog; state.loc = loc; state.buf = buf;
			state.aPos = gl.getAttribLocation(prog, 'aPos');
			state.texEst = makeTexture(gl);
			state.texGrid = makeTexture(gl);
			return true;
		} catch (err) {
			return fail(String(err && err.message || err));
		}
	}

	function render(input) {
		if (!init()) throw new Error(state.why || 'WebGL unavailable');
		const K = svc('contrast'), maxRuns = svc('limits').maxRuns, maxC = maxRuns + 1;
		const { est, grid, w, h, s, W, H, params, colors } = input;
		const gl = state.gl, L = state.loc;

		if (state.canvas.width !== w || state.canvas.height !== h) { state.canvas.width = w; state.canvas.height = h; }
		gl.viewport(0, 0, w, h);
		gl.useProgram(state.prog);

		// Estimated backdrop -> texture unit 0. A tainted canvas throws SecurityError: veil only.
		let hasEst = 0, tainted = false;
		if (est) {
			try {
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, state.texEst);
				gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
				gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, est);
				hasEst = 1;
			} catch (e) { tainted = true; }
		}

		// Unknown cells -> texture unit 1.
		const bytes = new Uint8Array(grid.nx * grid.ny);
		for (let i = 0; i < bytes.length; i++) bytes[i] = grid.V[i] ? 255 : 0;
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, state.texGrid);
		gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, grid.nx, grid.ny, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, bytes);

		// Per-colour parameters come from the shared contrast utilities.
		const rS = K.solveRatio(params.ratio), tri = params.mode === 'tricontrast';
		const runs = colors.runs.slice(0, maxRuns);
		const pcs = [K.prepareColor(colors.base, rS)].concat(runs.map((r) => K.prepareColor(r.c, rS)));
		const yT = new Float32Array(maxC), pk = new Float32Array(maxC), al = new Float32Array(maxC), vc = new Float32Array(maxC);
		pcs.forEach((p, i) => { yT[i] = p.yT; pk[i] = p.pkL; al[i] = p.al; vc[i] = p.vc / 255; });
		const rect = new Float32Array(maxRuns * 4);
		runs.forEach((r, i) => { rect[i * 4] = r.x0; rect[i * 4 + 1] = r.y0; rect[i * 4 + 2] = r.x1; rect[i * 4 + 3] = r.y1; });
		const band = K.band(params.ratio), tv = K.bandVeil(band);

		gl.uniform1i(L.uEst, 0);
		gl.uniform1i(L.uGrid, 1);
		gl.uniform2f(L.uSize, w, h);
		gl.uniform2f(L.uDim, W, H);
		gl.uniform1f(L.uScale, s);
		gl.uniform1f(L.uFeather, params.feather);
		gl.uniform3f(L.uGridInfo, grid.nx, grid.ny, grid.g);
		gl.uniform1f(L.uHasEst, hasEst);
		gl.uniform1f(L.uTri, tri ? 1 : 0);
		gl.uniform1f(L.uRatioS, rS);
		gl.uniform2f(L.uBand, band.lo, band.hi);
		gl.uniform2f(L.uTriVeil, tv.al, tv.vc / 255);
		gl.uniform1i(L.uRunCount, runs.length);
		gl.uniform4fv(L.uRun, rect);
		gl.uniform1fv(L.uYT, yT);
		gl.uniform1fv(L.uPk, pk);
		gl.uniform1fv(L.uAl, al);
		gl.uniform1fv(L.uVc, vc);

		gl.bindBuffer(gl.ARRAY_BUFFER, state.buf);
		gl.enableVertexAttribArray(state.aPos);
		gl.vertexAttribPointer(state.aPos, 2, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

		const err = gl.getError();
		if (err !== gl.NO_ERROR) throw new Error('WebGL error 0x' + err.toString(16));
		return { source: state.canvas, stats: null, tainted };
	}

	window.j0.register('ipax-backdrop:kernel-webgl', {
		available: init,
		render,
		disable: fail,
		reason: () => state.why,
		reset: () => { state.broken = false; state.why = ''; state.gl = null; state.canvas = null; }
	});
})();
