// R2 media library plugin for Sveltia CMS
// Loaded as a plain script (not an ES module) — sets window.R2MediaLibrary.
// Registration happens in index.html after both this script and Sveltia have loaded.

const WORKER_URL = 'https://musictide-media-upload.leftfield.workers.dev';

function createMediaDialog(onInsert) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center';

  const dialog = document.createElement('div');
  dialog.style.cssText = 'background:#fff;border-radius:8px;padding:24px;min-width:480px;max-width:640px;width:90%';

  dialog.innerHTML = `
    <h2 style="margin:0 0 16px;font-size:18px">Carregar Imagem</h2>
    <input type="file" id="r2-file-input" accept="image/*,video/*" style="display:block;margin-bottom:16px">
    <div id="r2-status" style="font-size:14px;color:#666;margin-bottom:16px"></div>
    <div id="r2-file-list" style="max-height:280px;overflow-y:auto;border:1px solid #ddd;border-radius:4px;margin-bottom:16px"></div>
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button id="r2-cancel" style="padding:8px 16px;border:1px solid #ccc;border-radius:4px;cursor:pointer;background:#fff">Cancelar</button>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const statusEl = dialog.querySelector('#r2-status');
  const fileListEl = dialog.querySelector('#r2-file-list');
  const fileInput = dialog.querySelector('#r2-file-input');

  function close() {
    document.body.removeChild(overlay);
  }

  dialog.querySelector('#r2-cancel').onclick = close;
  overlay.onclick = (e) => { if (e.target === overlay) close(); };

  // Load existing files from R2
  statusEl.textContent = 'A carregar ficheiros…';
  fetch(`${WORKER_URL}/list`)
    .then((r) => r.json())
    .then((files) => {
      statusEl.textContent = files.length ? '' : 'Sem ficheiros. Carregue um abaixo.';
      fileListEl.innerHTML = files
        .sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded))
        .map(
          (f) =>
            `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;cursor:pointer;border-bottom:1px solid #eee" data-url="${f.url}" data-name="${f.name}" class="r2-file-item">
              <img src="${f.url}" style="width:40px;height:40px;object-fit:cover;border-radius:3px" onerror="this.style.display='none'">
              <span style="font-size:12px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.name}</span>
            </div>`
        )
        .join('');

      fileListEl.querySelectorAll('.r2-file-item').forEach((item) => {
        item.onclick = () => {
          onInsert({ url: item.dataset.url, alt: item.dataset.name });
          close();
        };
      });
    })
    .catch(() => { statusEl.textContent = 'Erro ao carregar lista de ficheiros.'; });

  // Upload a new file
  fileInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    statusEl.textContent = `A carregar ${file.name}…`;
    fileInput.disabled = true;

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${WORKER_URL}/upload`, { method: 'POST', body: formData });
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      onInsert({ url, alt: file.name });
      close();
    } catch (err) {
      statusEl.textContent = `Erro: ${err.message}`;
      fileInput.disabled = false;
    }
  };
}

window.R2MediaLibrary = {
  name: 'r2',
  init: () => ({
    show: ({ onInsert }) => createMediaDialog(onInsert),
    hide: () => {},
    enableStandalone: () => false,
  }),
};
