export async function writeClipboard(text, container = document.body) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const input = document.createElement('textarea');
    input.value = text; input.setAttribute('aria-label', '복사할 내용');
    input.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    container.append(input); input.focus(); input.select();
    try { return document.execCommand('copy'); }
    catch { return false; }
    finally { input.remove(); }
  }
}
