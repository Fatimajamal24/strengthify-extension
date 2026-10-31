// Shared by the background script and the popup: loads the model files, runs both models and combines them.
(function (root) {
  // How to combine the two models (both are always required):
  //   "best": use the Random Forest when it is at least 70% sure, otherwise use the SVM (most accurate in testing)
  //   "safe": if the two models agree show that, if they disagree show Medium (fewest dangerous mistakes)
  const COMBINE_MODE = "best";
  const SURE = 0.7;
  const NAMES = ["Weak", "Medium", "Strong"];

  const REQUIRED = ["rf.bin", "svm.bin", "common_passwords.txt", "english_words.txt"];

  // Loads all 4 files from inside the extension. Throws a clear error if any is missing or unreadable:
  // there is no fallback, the extension works only with your own models.
  async function loadEngine(urlFor) {            // urlFor(file) must return an address INSIDE the extension
    const get = async (f) => {
      try {
        const r = await fetch(urlFor(f));
        if (!r.ok) return null;
        return f.endsWith(".bin") ? await r.arrayBuffer() : await r.text();
      } catch (e) { return null; }
    };
    const files = await Promise.all(REQUIRED.map(get));
    const missing = REQUIRED.filter((f, i) => !files[i]);
    if (missing.length) throw new Error("Missing model file(s) in ext/model/: " + missing.join(", "));
    const [rfBin, svmBin, common, english] = files;

    const models = {};
    try {
      if (new DataView(rfBin).getUint32(0, true) !== 0x32424652) throw new Error("rf.bin is not a Random Forest export (RFB2)");
      if (new DataView(svmBin).getUint32(0, true) !== 0x314D5653) throw new Error("svm.bin is not an SVM export (SVM1)");
      const forest = root.PW.loadForest(rfBin);
      models.forest = { predict: f => { const probs = forest.predictProba(f); return { cls: probs.indexOf(Math.max(...probs)), probs }; } };
      models.svm = root.PW.loadSvm(svmBin);
    } catch (e) { throw new Error("Could not read the model files: " + e.message); }

    const set = t => new Set(t.split("\n").filter(Boolean));
    return { feats: root.PW.createFeatures(set(common), set(english)), models };
  }

  function combine(rf, svm, mode = COMBINE_MODE) {
    if (rf && svm) {
      if (mode === "safe") return rf.cls === svm.cls ? { cls: rf.cls, by: "both" } : { cls: 1, by: "disagree" };
      if (rf.probs[rf.cls] >= SURE - 1e-4) return { cls: rf.cls, by: rf.cls === svm.cls ? "both" : "forest" };
      return { cls: svm.cls, by: rf.cls === svm.cls ? "both" : "svm" };
    }
    return rf ? { cls: rf.cls, by: "forest" } : { cls: svm.cls, by: "svm" };
  }

  function createScorer(engine) {
    return function score(pw) {
      pw = String(pw || "").slice(0, 128);
      if (!pw) return { cls: null };
      const features = engine.feats.extractFeatures(pw);
      const rf = engine.models.forest.predict(features);
      const svm = engine.models.svm.predict(features);
      return { cls: combine(rf, svm).cls };
    };
  }
  root.PW = Object.assign(root.PW || {}, { loadEngine, createScorer, combine, MODEL_NAMES: NAMES });
})(typeof globalThis !== "undefined" ? globalThis : this);