const CSS = `
*{box-sizing:border-box}
html,body{margin:0;min-height:100%;background:var(--oc-bg);color:var(--oc-fg);font-family:var(--oc-font);font-size:14px;line-height:1.45}
#root{min-height:100%}
.kb-page{display:flex;flex-direction:column;gap:14px;padding:16px;min-height:100%}
.kb-toolbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.kb-toolbar .grow{flex:1;min-width:160px}
.kb-columns{display:flex;gap:12px;align-items:flex-start;overflow-x:auto;padding-bottom:8px;flex:1}
.kb-column{flex:1 0 220px;min-width:220px;max-width:320px;display:flex;flex-direction:column;background:var(--oc-muted-surface);border:1px solid var(--oc-border);border-radius:var(--oc-radius,10px);min-height:120px}
.kb-column.kb-dragover{outline:2px solid var(--oc-focus);outline-offset:-2px}
.kb-column.kb-dragover-blocked{outline:2px dashed var(--oc-danger, #c44);outline-offset:-2px;cursor:not-allowed}
.kb-column-head{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-bottom:1px solid var(--oc-border)}
.kb-column-title{font-weight:600;font-size:12px;letter-spacing:.02em;text-transform:uppercase;color:var(--oc-muted)}
.kb-column-count{font:11px var(--oc-mono);color:var(--oc-muted)}
.kb-column-body{display:flex;flex-direction:column;gap:8px;padding:10px;overflow-y:auto;flex:1;min-height:40px}
.kb-column-empty{font-size:12px;color:var(--oc-muted);padding:8px 2px}
.kb-card{background:var(--oc-elevated);color:var(--oc-elevated-fg);border:1px solid var(--oc-border);border-radius:9px;padding:10px;cursor:pointer;display:flex;flex-direction:column;gap:6px}
.kb-card:hover{border-color:var(--oc-hover)}
.kb-card.kb-dragging{opacity:.4}
.kb-card.kb-card-needs-attention{border-color:var(--oc-warning);border-left-width:3px}
.kb-card.kb-card-needs-attention:hover{border-color:var(--oc-warning)}
.kb-card-title{font-weight:550;font-size:13px;overflow-wrap:anywhere}
.kb-card-meta{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.kb-card-ref{font:11px var(--oc-mono);color:var(--oc-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.kb-overlay{position:fixed;inset:0;background:rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;padding:24px;z-index:50}
.kb-dialog{background:var(--oc-bg);color:var(--oc-fg);border:1px solid var(--oc-border);border-radius:12px;max-width:640px;width:100%;max-height:88vh;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:14px}
.kb-dialog h2{margin:0;font-size:18px;letter-spacing:-.01em}
.kb-dialog-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.kb-dialog-grid .kb-span2{grid-column:1/-1}
.kb-section{display:flex;flex-direction:column;gap:8px;border-top:1px solid var(--oc-border);padding-top:12px}
.kb-section-title{font-size:12px;font-weight:600;color:var(--oc-muted);text-transform:uppercase;letter-spacing:.02em}
.kb-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.kb-row.between{justify-content:space-between}
.kb-muted{color:var(--oc-muted);font-size:12px}
.kb-mono{font:12px var(--oc-mono);color:var(--oc-muted)}
.kb-empty-state{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:48px 16px;color:var(--oc-muted);text-align:center}
.kb-radio-group{display:flex;flex-direction:column;gap:10px}
.kb-radio-option{display:flex;gap:10px;align-items:flex-start;cursor:pointer}
.kb-radio-option input{margin-top:3px;accent-color:var(--oc-primary)}
.kb-radio-title{font-weight:550;font-size:13px}
.kb-radio-desc{font-size:12px;color:var(--oc-muted);margin-top:2px}
.kb-banner{display:none}
.kb-banner[data-show]{display:block}
[hidden]{display:none!important}
.kb-dialog-wide{max-width:920px}
.kb-ticket-meta{align-items:center;gap:8px}
.kb-badge{font:11px var(--oc-mono);border:1px solid var(--oc-border);border-radius:999px;padding:1px 7px;color:var(--oc-muted);white-space:nowrap}
.kb-card-number{font:11px var(--oc-mono);color:var(--oc-muted);white-space:nowrap}
.kb-card-title-wrap{display:flex;align-items:center;gap:6px;min-width:0;flex-wrap:wrap}
.kb-next{font:10px var(--oc-mono);font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--oc-primary);border:1px solid var(--oc-primary);border-radius:999px;padding:1px 6px}
.kb-card-attention{font-size:11px;color:var(--oc-warning);margin:0}
.kb-card-conflict{font-size:11px;color:var(--oc-danger,var(--oc-warning));margin:0}
.kb-ticket-body{white-space:pre-wrap;overflow-wrap:anywhere;background:var(--oc-muted-surface);border:1px solid var(--oc-border);border-radius:8px;padding:10px;margin:0;font:12px/1.5 var(--oc-mono);max-height:340px;overflow:auto}
.kb-ticket-comments{max-height:220px}
.kb-action-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.kb-action{display:flex;flex-direction:column;gap:4px;min-width:0}
.kb-action-reason{font-size:10px;color:var(--oc-muted);line-height:1.25}
.kb-diff{max-height:52vh;overflow:auto;border:1px solid var(--oc-border);border-radius:8px;background:var(--oc-code-bg,var(--oc-muted-surface));padding:8px;font:11px/1.45 var(--oc-mono)}
.kb-diff-line{white-space:pre-wrap;overflow-wrap:anywhere;padding:0 4px;border-radius:2px}
.kb-diff-add{background:color-mix(in srgb,var(--oc-success,#3fb950) 18%,transparent)}
.kb-diff-del{background:color-mix(in srgb,var(--oc-danger,#f85149) 18%,transparent)}
.kb-diff-hunk{color:var(--oc-muted);border-top:1px solid var(--oc-border);margin-top:4px;padding-top:4px}
.kb-commit-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:var(--oc-muted-surface);border:1px solid var(--oc-border);border-radius:9px;padding:8px 10px;font-size:12px}
.kb-footer{font-size:12px}
.kb-panel .kb-panel-body{display:flex;flex-direction:column;gap:6px}
.kb-panel .kb-panel-body p{margin:0}
.kb-unlinked-row{border-top:1px solid var(--oc-border);padding-top:8px;margin-top:4px}
`;

export const injectStyles = () => {
  if (document.getElementById('kb-style')) return;
  const style = document.createElement('style');
  style.id = 'kb-style';
  style.textContent = CSS;
  document.head.append(style);
};
