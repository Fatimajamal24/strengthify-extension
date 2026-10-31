// Runs a scikit-learn RBF SVC (inside a StandardScaler pipeline) exported by tools/export_for_extension.py.
// Gives the same label as pipeline.predict(): one-vs-one voting, ties go to the lowest class number.
(function (root) {
  function loadSvm(buf) {
    const dv = new DataView(buf);
    if (dv.getUint32(0, true) !== 0x314D5653) throw new Error("Bad model file");   // "SVM1"
    const nSV = dv.getUint32(4, true), nF = dv.getUint32(8, true), nC = dv.getUint32(12, true), nP = nC * (nC - 1) / 2;
    let off = 16;
    const take = (Type, count) => { off = Math.ceil(off / Type.BYTES_PER_ELEMENT) * Type.BYTES_PER_ELEMENT;
      const a = new Type(buf, off, count); off += count * Type.BYTES_PER_ELEMENT; return a; };
    const gamma = take(Float64Array, 1)[0], mean = take(Float64Array, nF), scale = take(Float64Array, nF);
    const intercept = take(Float64Array, nP), sv = take(Float64Array, nSV * nF), dual = take(Float64Array, (nC - 1) * nSV), nSupport = take(Int32Array, nC);
    const start = [0]; for (let c = 0; c < nC; c++) start.push(start[c] + nSupport[c]);

    function predict(x) {
      const z = new Float64Array(nF); for (let j = 0; j < nF; j++) z[j] = (x[j] - mean[j]) / scale[j];
      const K = new Float64Array(nSV);
      for (let s = 0; s < nSV; s++) { let d = 0; const b = s * nF; for (let j = 0; j < nF; j++) { const t = z[j] - sv[b + j]; d += t * t; } K[s] = Math.exp(-gamma * d); }
      const votes = new Array(nC).fill(0); let p = 0;
      for (let i = 0; i < nC; i++) for (let j = i + 1; j < nC; j++, p++) {
        let sum = intercept[p];
        for (let k = start[i]; k < start[i + 1]; k++) sum += dual[(j - 1) * nSV + k] * K[k];
        for (let k = start[j]; k < start[j + 1]; k++) sum += dual[i * nSV + k] * K[k];
        votes[sum > 0 ? i : j]++;
      }
      let cls = 0; for (let c = 1; c < nC; c++) if (votes[c] > votes[cls]) cls = c;
      return { cls, probs: null };
    }
    return { kind: "svm", predict, nSV };
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { loadSvm }; else root.PW = Object.assign(root.PW || {}, { loadSvm });
})(typeof globalThis !== "undefined" ? globalThis : this);
