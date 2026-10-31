const { LABELS } = PW;
const TONE = [{ fill: "#ef4444", solid: "#d92d20" }, { fill: "#f59e0b", solid: "#b54708" }, { fill: "#22c55e", solid: "#067647" }];
const $ = id => document.getElementById(id);
const pw = $("pw");
$("toggle").onclick = () => { pw.type = pw.type === "password" ? "text" : "password"; };

let score = null;
(async () => {
  try {
    const engine = await PW.loadEngine(f => "model/" + f);
    score = PW.createScorer(engine);
  } catch (e) {
    const n = $("notice"); n.textContent = e.message + ". Strengthify needs all 4 files in ext/model/: rf.bin, svm.bin, common_passwords.txt, english_words.txt.";
    n.classList.remove("hidden");
    $("empty").classList.add("hidden"); pw.disabled = true;
  }
  render();
})();

function render() {
  const v = pw.value;
  if (!score || !v) { $("result").classList.add("hidden"); $("empty").classList.remove("hidden"); return; }
  const r = score(v), c = TONE[r.cls].solid, fill = TONE[r.cls].fill;
  $("empty").classList.add("hidden"); $("result").classList.remove("hidden");
  $("pill").textContent = LABELS[r.cls]; $("pill").style.background = c;
  [...$("meter").children].forEach((el, i) => { el.style.background = i <= r.cls ? fill : ""; });
}
pw.addEventListener("input", render);
try { $("ver").textContent = "v" + (globalThis.browser ?? globalThis.chrome).runtime.getManifest().version; } catch (e) {}
pw.focus();