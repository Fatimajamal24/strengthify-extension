// Runs a scikit-learn RandomForestClassifier exported by tools/export_for_extension.py (file: model/model.bin)
(function (root) {
  function loadForest(buf) {
    const dv = new DataView(buf);
    if (dv.getUint32(0, true) !== 0x32424652) throw new Error("Bad model file");   // "RFB2"
    const nTrees = dv.getUint32(4, true), nClasses = dv.getUint32(8, true);
    const nNodes = dv.getUint32(12, true), nLeaves = dv.getUint32(16, true);
    let off = 20;
    const take = (Type, count) => { off = Math.ceil(off / Type.BYTES_PER_ELEMENT) * Type.BYTES_PER_ELEMENT;
      const a = new Type(buf, off, count); off += count * Type.BYTES_PER_ELEMENT; return a; };
    const roots = take(Int32Array, nTrees), feature = take(Int8Array, nNodes), threshold = take(Float32Array, nNodes);
    const right = take(Int32Array, nNodes), leaf = take(Uint16Array, nLeaves * nClasses);

    function predictProba(x) {
      const xf = Float64Array.from(x, v => Math.fround(v));        // sklearn casts inputs to float32; thresholds are stored float32-floored so this is exact
      const acc = new Float64Array(nClasses);
      for (let t = 0; t < nTrees; t++) {
        let i = roots[t];
        while (feature[i] >= 0) i = xf[feature[i]] <= threshold[i] ? i + 1 : right[i];
        const base = right[i] * nClasses;
        for (let c = 0; c < nClasses; c++) acc[c] += leaf[base + c] / 65535;
      }
      for (let c = 0; c < nClasses; c++) acc[c] /= nTrees;
      return Array.from(acc);
    }
    return { predictProba, nTrees, nNodes };
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { loadForest }; else root.PW = Object.assign(root.PW || {}, { loadForest });
})(typeof globalThis !== "undefined" ? globalThis : this);
