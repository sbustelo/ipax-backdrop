/**
 * ipax-backdrop / 3200-kernel-webgl.js
 * SPDX-License-Identifier: Apache-2.0
 *
 * CHAPTER 3 - KERNEL, WebGL backend. Paired with 3100-kernel-cpu.js and 3210-kernel-webgl-shaders.js.
 *
 * Service 'ipax-backdrop:kernel-webgl': available(), render(input),
 *   disable(reason), reason(), reset()
 */
(function () {
	'use strict';
	if (!window.j0 || !window.j0.register) return;

	const svc = (n) => window.j0.get('ipax-backdrop:' + n);
	const UNIFORMS = [
		'uEst', 'uEstBlur', 'uHasBlur', 'uBlurRatios',
		'uGrid', 'uHalo', 'uSize', 'uTexSize', 'uGridTex',
		'uHaloTex', 'uHaloInfo', 'uHaloOn', 'uHaloShared',
		'uBox', 'uDim', 'uScale', 'uFeather', 'uGridInfo',
		'uHasEst', 'uTri', 'uTriH', 'uRatioS', 'uRatioSH',
		'uBypass', 'uBypassH', 'uBoxCover',
		'uBand', 'uBandH', 'uTriVeil', 'uTriVeilH',
		'uInfl', 'uRunCount', 'uRun', 'uCol', 'uColH'
	];
	const ALIGN = 64;
	const up = (v, a) => Math.ceil(v / (a || ALIGN)) * (a || ALIGN);

	function freshState() {
		return {
			canvas: null, gl: null, prog: null, loc: null, texEst: null, texGrid: null, texBlur: null, texHalo: null, buf: null, aPos: -1,
			broken: false, why: '',
			cw: 0, ch: 0,
			tw: 0, th: 0,
			bw: 0, bh: 0,
			gw: 0, gh: 0,
			hw: 0, hh: 0,
			maxDim: 0, n: 0,
			col: null, colH: null, rect: null,
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

	function makeTexture(gl, linear) {
		const t = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, t);
		const filter = linear ? gl.LINEAR : gl.NEAREST;
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
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

			gl.useProgram(prog);
			gl.uniform1i(loc.uEst, 0);
			gl.uniform1i(loc.uGrid, 1);
			gl.uniform1i(loc.uEstBlur, 2);
			gl.uniform1i(loc.uHalo, 3);
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

			state.cw = state.ch = state.tw = state.th = state.bw = state.bh = state.gw = state.gh = state.hw = state.hh = 0;
			const mvd = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
			state.maxDim = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), mvd[0], mvd[1]);
			state.col = new Float32Array(maxC * 4); state.colH = new Float32Array(maxC * 4);
			state.rect = new Float32Array(maxRuns * 4);

			state.canvas = canvas; state.gl = gl; state.prog = prog; state.loc = loc; state.buf = buf; state.aPos = aPos;
			gl.activeTexture(gl.TEXTURE0); state.texEst = makeTexture(gl);
			gl.activeTexture(gl.TEXTURE1); state.texGrid = makeTexture(gl);
			gl.activeTexture(gl.TEXTURE2); state.texBlur = makeTexture(gl);
			gl.activeTexture(gl.TEXTURE3); state.texHalo = makeTexture(gl, true);
			return true;
		} catch (err) {
			return fail(String(err && err.message || err));
		}
	}

	function render(input) {
		if (!init()) throw new Error(state.why || 'WebGL unavailable');
		const K = svc('contrast'), maxRuns = svc('limits').maxRuns;
		const { est, estBlur, grid, w, h, s, W, H, params, colors } = input;
		const halo = input.halo && input.halo.mask ? input.halo : null;
		const gl = state.gl, L = state.loc, maxDim = state.maxDim;
		if (w > maxDim || h > maxDim || grid.nx > maxDim || grid.ny > maxDim) throw new Error('working size ' + w + 'x' + h + ' exceeds the GPU limit ' + maxDim);

		if (w > state.cw || h > state.ch) {
			state.cw = Math.min(maxDim, Math.max(state.cw, up(w)));
			state.ch = Math.min(maxDim, Math.max(state.ch, up(h)));
			state.canvas.width = state.cw; state.canvas.height = state.ch;
		}
		gl.viewport(0, 0, w, h);

		if (w > state.tw || h > state.th) {
			state.tw = Math.min(maxDim, Math.max(state.tw, up(w)));
			state.th = Math.min(maxDim, Math.max(state.th, up(h)));
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, state.texEst);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, state.tw, state.th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
			state.bw = 0; state.bh = 0;
		}
		let hasEst = 0, tainted = false;
		if (est) {
			try {
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D, state.texEst);
				gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, est);
				hasEst = 1;
			} catch (e) { tainted = true; }
		}

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
			} catch (e) { }
		}

		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, state.texGrid);
		if (grid.nx > state.gw || grid.ny > state.gh) {
			state.gw = Math.min(maxDim, Math.max(state.gw, up(grid.nx, 16)));
			state.gh = Math.min(maxDim, Math.max(state.gh, up(grid.ny, 16)));
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, state.gw, state.gh, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, null);
		}
		gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, grid.nx, grid.ny, gl.LUMINANCE, gl.UNSIGNED_BYTE, grid.V);

		let hmw = 1, hmh = 1, hcs = 1;
		if (halo) {
			const mk = halo.mask;
			hmw = mk.mw; hmh = mk.mh; hcs = mk.cs;
			if (hmw > maxDim || hmh > maxDim) throw new Error('halo mask ' + hmw + 'x' + hmh + ' exceeds the GPU limit ' + maxDim);
			gl.activeTexture(gl.TEXTURE3);
			gl.bindTexture(gl.TEXTURE_2D, state.texHalo);
			if (hmw > state.hw || hmh > state.hh) {
				state.hw = Math.min(maxDim, Math.max(state.hw, up(hmw, 16)));
				state.hh = Math.min(maxDim, Math.max(state.hh, up(hmh, 16)));
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, state.hw, state.hh, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, null);
			}
			gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, hmw, hmh, gl.LUMINANCE, gl.UNSIGNED_BYTE, mk.data);
		}

		const rS = K.solveRatio(params.ratio), triB = params.mode === 'tricontrast';
		const rH = halo ? halo.ratio : params.ratio, rSH = K.solveRatio(rH);
		const triH = halo ? ((halo.mode || params.mode) === 'tricontrast') : triB;
		const shared = !!(halo && halo.shared);
		const bypassB = K.isBypass(params.ratio);
		const bypassH = !halo || K.isBypass(rH);

		const boxBlur = input.boxBlur !== undefined ? input.boxBlur : (params.blur || 0);
		const textBlur = input.textBlur !== undefined ? input.textBlur : (halo ? (halo.blur || 0) : 0);
		const maxBlur = input.maxBlur !== undefined ? input.maxBlur : Math.max(boxBlur, textBlur);
		const boxBlurRatio = maxBlur > 0 ? boxBlur / maxBlur : 0;
		const textBlurRatio = maxBlur > 0 ? textBlur / maxBlur : 0;

		const runs = colors.runs.length > maxRuns ? colors.runs.slice(0, maxRuns) : colors.runs;
		const pcs = [K.prepareColor(colors.base, rS)];
		for (let i = 0; i < runs.length; i++) pcs.push(K.prepareColor(runs[i].c, rS));
		let pcsH = pcs;
		if (halo && !shared) {
			pcsH = [K.prepareColor(colors.base, rSH)];
			for (let i = 0; i < runs.length; i++) pcsH.push(K.prepareColor(runs[i].c, rSH));
		}
		const col = state.col, colH = state.colH, rect = state.rect;
		for (let i = 0; i < pcs.length; i++) {
			const p = pcs[i], q = pcsH[i];
			col[i * 4] = p.yT; col[i * 4 + 1] = p.pkL; col[i * 4 + 2] = p.al; col[i * 4 + 3] = p.vc / 255;
			colH[i * 4] = q.yT; colH[i * 4 + 1] = q.pkL; colH[i * 4 + 2] = q.al; colH[i * 4 + 3] = q.vc / 255;
		}
		for (let i = 0; i < runs.length; i++) { const r = runs[i]; rect[i * 4] = r.x0; rect[i * 4 + 1] = r.y0; rect[i * 4 + 2] = r.x1; rect[i * 4 + 3] = r.y1; }
		const band = K.band(params.ratio), tv = K.bandVeil(band);
		const bandH = halo ? K.band(rH) : band, tvH = halo ? K.bandVeil(bandH) : tv;

		gl.uniform1f(L.uHasBlur, hasBlur);
		gl.uniform2f(L.uBlurRatios, boxBlurRatio, textBlurRatio);
		gl.uniform2f(L.uSize, w, h);
		gl.uniform2f(L.uTexSize, state.tw, state.th);
		gl.uniform2f(L.uGridTex, state.gw, state.gh);
		gl.uniform2f(L.uHaloTex, state.hw || 1, state.hh || 1);
		gl.uniform3f(L.uHaloInfo, hmw, hmh, hcs);
		gl.uniform1f(L.uHaloOn, halo ? 1 : 0);
		gl.uniform1f(L.uHaloShared, shared ? 1 : 0);
		gl.uniform2f(L.uBox, input.ox || 0, input.oy || 0);
		gl.uniform2f(L.uDim, W, H);
		gl.uniform1f(L.uScale, s);
		const fParam = params.feather;
		const f = (typeof fParam === 'number')
			? { top: fParam, right: fParam, bottom: fParam, left: fParam }
			: (fParam || { top: 0, right: 0, bottom: 0, left: 0 });
		gl.uniform4f(L.uFeather, f.top || 0, f.right || 0, f.bottom || 0, f.left || 0);
		gl.uniform3f(L.uGridInfo, grid.nx, grid.ny, grid.g);
		gl.uniform1f(L.uHasEst, hasEst);
		gl.uniform1f(L.uTri, triB ? 1 : 0);
		gl.uniform1f(L.uTriH, triH ? 1 : 0);
		gl.uniform1f(L.uRatioS, rS);
		gl.uniform1f(L.uRatioSH, rSH);
		gl.uniform1f(L.uBypass, bypassB ? 1 : 0);
		gl.uniform1f(L.uBypassH, bypassH ? 1 : 0);
		gl.uniform1f(L.uBoxCover, input.boxCover === false ? 0 : 1);
		gl.uniform2f(L.uBand, band.lo, band.hi);
		gl.uniform2f(L.uBandH, bandH.lo, bandH.hi);
		gl.uniform2f(L.uTriVeil, tv.al, tv.vc / 255);
		gl.uniform2f(L.uTriVeilH, tvH.al, tvH.vc / 255);
		gl.uniform1f(L.uInfl, input.infl > 6 ? input.infl : 6);
		gl.uniform1i(L.uRunCount, runs.length);
		gl.uniform4fv(L.uRun, rect);
		gl.uniform4fv(L.uCol, col);
		gl.uniform4fv(L.uColH, colH);

		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

		if (state.n++ < 4 || (state.n & 15) === 0) {
			const err = gl.getError();
			if (err !== gl.NO_ERROR) throw new Error('WebGL error 0x' + err.toString(16));
		}

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