// Runs your model. The password only travels from the page to this script INSIDE the browser; nothing goes online.
if (typeof importScripts === "function") importScripts("lib/features.js", "lib/forest.js", "lib/svm.js", "lib/scorer.js");   // Chrome service worker
const api = globalThis.browser ?? globalThis.chrome;

const scorerPromise = PW.loadEngine(f => api.runtime.getURL("model/" + f)).then(engine => PW.createScorer(engine));

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || msg.type !== "score") return;
  scorerPromise.then(score => sendResponse(score(msg.pw)), () => sendResponse({ cls: null }));
  return true;                            // keep the channel open for the async answer
});