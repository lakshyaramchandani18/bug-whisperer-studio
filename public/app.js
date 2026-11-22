/**
 * Bug Whisperer Studio - Client Application Logic
 */

import { ansiToHtml } from './ansi.js';

// Application State
const state = {
  codebasePath: '',
  packagePath: '',
  personality: 'friendly',
  currentRunning: false,
  selectedFilePath: null,
  activeDiagnosis: null,
  activeFileContent: null,
  rules: [],
  ws: null
};

// DOM Elements
const el = {
  headerCodebasePath: document.getElementById('header-codebase-path'),
  packageBadgeText: document.getElementById('package-badge-text'),
  personalitySelect: document.getElementById('personality-select'),
  projName: document.getElementById('proj-name'),
  projVersion: document.getElementById('proj-version'),
  projDesc: document.getElementById('proj-desc'),
  scriptsList: document.getElementById('scripts-list'),
  fileTreeList: document.getElementById('file-tree-list'),
  fileCountLabel: document.getElementById('file-count-label'),
  terminalOutput: document.getElementById('terminal-output'),
  cmdInput: document.getElementById('cmd-input'),
  btnRunCmd: document.getElementById('btn-run-cmd'),
  btnStopCmd: document.getElementById('btn-stop-cmd'),
  btnClearTerm: document.getElementById('btn-clear-term'),
  diagnosisContainer: document.getElementById('diagnosis-container'),
  diagErrorName: document.getElementById('diag-error-name'),
  diagSeverity: document.getElementById('diag-severity'),
  diagRuleMeta: document.getElementById('diag-rule-meta'),
  diagConfidence: document.getElementById('diag-confidence'),
  quoteAuthor: document.getElementById('quote-author'),
  quoteText: document.getElementById('quote-text'),
  diagExplanation: document.getElementById('diag-explanation'),
  diagWhy: document.getElementById('diag-why'),
  diagFilePath: document.getElementById('diag-file-path'),
  btnJumpCode: document.getElementById('btn-jump-code'),
  diffContainer: document.getElementById('diff-container'),
  diffBeforeCode: document.getElementById('diff-before-code'),
  diffAfterCode: document.getElementById('diff-after-code'),
  diagSolutionsList: document.getElementById('diag-solutions-list'),
  diagChecklist: document.getElementById('diag-checklist'),
  checklistProgress: document.getElementById('checklist-progress'),
  btnCloseDiag: document.getElementById('btn-close-diag'),
  btnCopyReport: document.getElementById('btn-copy-report'),
  viewerFilePath: document.getElementById('viewer-file-path'),
  fileCodeDisplay: document.getElementById('file-code-display'),
  btnAnalyzeFileContent: document.getElementById('btn-analyze-file-content'),
  btnRunScan: document.getElementById('btn-run-scan'),
  scanSummaryLabel: document.getElementById('scan-summary-label'),
  scannerResults: document.getElementById('scanner-results'),
  scannerBadge: document.getElementById('scanner-badge'),
  sandboxInput: document.getElementById('sandbox-input'),
  btnSandboxAnalyze: document.getElementById('btn-sandbox-analyze'),
  sandboxResult: document.getElementById('sandbox-result'),
  rulesGrid: document.getElementById('rules-grid'),
  rulesCountTab: document.getElementById('rules-count-tab'),
  // Modals
  codebaseModal: document.getElementById('codebase-modal'),
  btnOpenCodebaseModal: document.getElementById('btn-open-codebase-modal'),
  btnCloseCodebaseModal: document.getElementById('btn-close-codebase-modal'),
  btnCancelCodebaseModal: document.getElementById('btn-cancel-codebase-modal'),
  btnConfirmCodebase: document.getElementById('btn-confirm-codebase'),
  modalPathInput: document.getElementById('modal-path-input'),
  btnBrowseDir: document.getElementById('btn-browse-dir'),
  browserItems: document.getElementById('browser-items'),
  presetSampleApp: document.getElementById('preset-sample-app'),
  presetNpmPkg: document.getElementById('preset-npm-pkg'),
  presetWorkspace: document.getElementById('preset-workspace'),
  btnRefreshInfo: document.getElementById('btn-refresh-info')
};

// Initialize Application
async function init() {
  setupTabs();
  setupEventListeners();
  initWebSocket();
  await loadStatus();
  await refreshProjectData();
  await loadRules();
}

// Setup Navigation Tabs
function setupTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const targetId = tab.getAttribute('data-tab');
      document.getElementById(targetId)?.classList.add('active');
    });
  });
}

// WebSocket Connection
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;

  state.ws = new WebSocket(wsUrl);

  state.ws.onopen = () => {
    console.log('⚡ Connected to Bug Whisperer WebSocket');
  };

  state.ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      handleWebSocketMessage(msg);
    } catch (e) {
      console.error('Failed to parse WS message:', e);
    }
  };

  state.ws.onclose = () => {
    console.log('WS disconnected. Reconnecting in 2s...');
    setTimeout(initWebSocket, 2000);
  };
}

function handleWebSocketMessage(msg) {
  switch (msg.type) {
    case 'run_start':
      setRunningState(true);
      appendTerminal(`\n\u001b[36m🚀 Running command:\u001b[0m \u001b[1m${msg.command}\u001b[0m\n\u001b[90m📁 In: ${msg.cwd}\u001b[0m\n`);
      break;

    case 'stdout':
      appendTerminal(msg.text);
      break;

    case 'stderr':
      appendTerminal(msg.text);
      break;

    case 'run_exit':
      setRunningState(false);
      const color = msg.code === 0 ? '32' : '31';
      appendTerminal(`\n\u001b[${color}m⚡ Process exited with code ${msg.code}\u001b[0m\n`);
      break;

    case 'run_killed':
      setRunningState(false);
      appendTerminal(`\n\u001b[33m⚠️ Process terminated by user.\u001b[0m\n`);
      break;

    case 'diagnosis_ready':
      renderDiagnosis(msg.diagnosis, msg.rawError);
      break;

    case 'codebase_changed':
      state.codebasePath = msg.path;
      el.headerCodebasePath.textContent = msg.path;
      refreshProjectData();
      break;

    case 'personality_changed':
      state.personality = msg.personality;
      el.personalitySelect.value = msg.personality;
      break;
  }
}

// Append text to terminal emulator
function appendTerminal(rawText) {
  const html = ansiToHtml(rawText);
  el.terminalOutput.insertAdjacentHTML('beforeend', html);
  el.terminalOutput.scrollTop = el.terminalOutput.scrollHeight;
}

function setRunningState(running) {
  state.currentRunning = running;
  if (running) {
    el.btnRunCmd.style.display = 'none';
    el.btnStopCmd.style.display = 'inline-flex';
  } else {
    el.btnRunCmd.style.display = 'inline-flex';
    el.btnStopCmd.style.display = 'none';
  }
}

// Load Initial Status
async function loadStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    state.codebasePath = data.codebasePath;
    state.packagePath = data.packagePath;
    state.personality = data.personality;

    el.headerCodebasePath.textContent = data.codebasePath;
    el.personalitySelect.value = data.personality;
    el.rulesCountTab.textContent = data.ruleCount;
  } catch (err) {
    console.error('Failed to load status:', err);
  }
}

// Refresh Project Info & Files
async function refreshProjectData() {
  try {
    // 1. Fetch info
    const infoRes = await fetch('/api/codebase/info');
    const info = await infoRes.json();

    el.projName.textContent = info.name || 'Unnamed Codebase';
    el.projVersion.textContent = info.version || '1.0.0';
    el.projDesc.textContent = info.description || info.path;

    // Render scripts
    el.scriptsList.innerHTML = '';
    const scriptKeys = Object.keys(info.scripts || {});

    if (scriptKeys.length > 0) {
      scriptKeys.forEach(name => {
        const cmd = info.scripts[name];
        const item = document.createElement('div');
        item.className = 'script-item';
        item.innerHTML = `
          <div>
            <div class="script-name">${escapeHtml(name)}</div>
            <div class="script-cmd">${escapeHtml(cmd)}</div>
          </div>
          <button class="btn-run" data-script="${escapeHtml(name)}">▶ Run</button>
        `;
        item.querySelector('.btn-run').addEventListener('click', () => {
          runScript(name);
        });
        el.scriptsList.appendChild(item);
      });
    } else if (info.runnableFiles && info.runnableFiles.length > 0) {
      info.runnableFiles.forEach(file => {
        const item = document.createElement('div');
        item.className = 'script-item';
        item.innerHTML = `
          <div>
            <div class="script-name">${escapeHtml(file)}</div>
            <div class="script-cmd">node ${escapeHtml(file)}</div>
          </div>
          <button class="btn-run" data-cmd="node ${escapeHtml(file)}">▶ Run</button>
        `;
        item.querySelector('.btn-run').addEventListener('click', () => {
          executeCommand(`node ${file}`);
        });
        el.scriptsList.appendChild(item);
      });
    } else {
      el.scriptsList.innerHTML = `<div style="font-size: 11px; color: var(--text-dim); padding: 8px;">No runnable scripts or files detected.</div>`;
    }

    // 2. Fetch File Tree
    const treeRes = await fetch('/api/codebase/tree');
    const treeData = await treeRes.json();
    renderFileTree(treeData.tree || []);

  } catch (err) {
    console.error('Failed to refresh project data:', err);
  }
}

// Render Tree View
function renderFileTree(nodes) {
  el.fileTreeList.innerHTML = '';
  let count = 0;

  function buildTree(list, container, level = 0) {
    list.forEach(node => {
      count++;
      const item = document.createElement('div');
      item.className = 'tree-node' + (node.ext === '.log' ? ' is-log' : '');
      item.style.paddingLeft = `${level * 14 + 8}px`;

      const icon = node.type === 'dir' ? '📁' : (node.ext === '.log' ? '📜' : '📄');
      item.innerHTML = `
        <span class="node-icon">${icon}</span>
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(node.name)}</span>
      `;

      if (node.type === 'file') {
        item.addEventListener('click', () => {
          document.querySelectorAll('.tree-node').forEach(n => n.classList.remove('active'));
          item.classList.add('active');
          loadFileIntoViewer(node.path);
        });
      }

      container.appendChild(item);

      if (node.type === 'dir' && node.children && node.children.length > 0) {
        buildTree(node.children, container, level + 1);
      }
    });
  }

  buildTree(nodes, el.fileTreeList);
  el.fileCountLabel.textContent = `${count} items`;
}

// Load File into Code Viewer
async function loadFileIntoViewer(filePath, targetLine = null) {
  try {
    const res = await fetch(`/api/codebase/file?path=${encodeURIComponent(filePath)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    state.selectedFilePath = filePath;
    state.activeFileContent = data.content;

    el.viewerFilePath.textContent = filePath;

    // Switch to Viewer tab if needed
    const viewerTabBtn = document.querySelector('[data-tab="tab-viewer"]');
    viewerTabBtn.click();

    // Render lines
    const lines = data.content.split('\n');
    el.fileCodeDisplay.innerHTML = '';

    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;
      const lineDiv = document.createElement('div');
      lineDiv.className = 'code-line' + (targetLine === lineNum ? ' highlighted-error' : '');
      lineDiv.id = `line-${lineNum}`;

      lineDiv.innerHTML = `
        <span class="line-number">${lineNum}</span>
        <span class="line-text">${escapeHtml(lineText)}</span>
      `;

      el.fileCodeDisplay.appendChild(lineDiv);
    });

    if (targetLine) {
      setTimeout(() => {
        const lineEl = document.getElementById(`line-${targetLine}`);
        if (lineEl) {
          lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  } catch (err) {
    alert(`Failed to load file: ${err.message}`);
  }
}

// Execute Script or Command
function runScript(scriptName) {
  el.cmdInput.value = `npm run ${scriptName}`;
  executeCommand(`npm run ${scriptName}`, scriptName);
}

async function executeCommand(command, scriptName = null) {
  try {
    el.diagnosisContainer.style.display = 'none';
    const res = await fetch('/api/runner/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, scriptName })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
  } catch (err) {
    appendTerminal(`\n\u001b[31mError starting command: ${err.message}\u001b[0m\n`);
  }
}

async function stopRunningCommand() {
  try {
    await fetch('/api/runner/kill', { method: 'POST' });
  } catch (err) {
    console.error('Failed to kill process:', err);
  }
}

// Render Bug Whisperer Diagnosis
function renderDiagnosis(diag, rawError) {
  if (!diag) return;
  state.activeDiagnosis = diag;

  el.diagErrorName.textContent = `${diag.errorName}: ${diag.message || ''}`;
  el.diagRuleMeta.textContent = `Rule: ${diag.ruleId} • Category: ${diag.category || 'General'}`;

  // Severity styling
  const sev = (diag.severity || 'high').toLowerCase();
  el.diagSeverity.textContent = sev.toUpperCase();
  el.diagSeverity.className = `severity-chip severity-${sev}`;

  // Confidence
  const confPct = Math.round((diag.confidence || 0.95) * 100);
  el.diagConfidence.textContent = `${confPct}%`;

  // Personality Commentary
  if (diag.personality) {
    el.quoteAuthor.textContent = `${state.personality.toUpperCase()} MENTOR`;
    el.quoteText.textContent = `"${diag.personality.commentary || diag.personality.greeting || ''}"`;
    document.getElementById('personality-box').style.display = 'flex';
  } else {
    document.getElementById('personality-box').style.display = 'none';
  }

  // Explanation & Technical Cause
  el.diagExplanation.textContent = diag.explanation || 'No plain explanation provided.';
  el.diagWhy.innerHTML = `<strong>Technical Root Cause:</strong> ${escapeHtml(diag.whyItHappens || 'Underlying runtime mismatch.')}`;

  // Location
  if (diag.location && diag.location.file) {
    const locText = `${diag.location.file}:${diag.location.line || 1}:${diag.location.column || 1}`;
    el.diagFilePath.textContent = locText;
    el.btnJumpCode.style.display = 'block';
    el.btnJumpCode.onclick = () => {
      loadFileIntoViewer(diag.location.file, diag.location.line);
    };
  } else {
    el.diagFilePath.textContent = 'Location not detected in stack trace.';
    el.btnJumpCode.style.display = 'none';
  }

  // Visual Code Diff
  if (diag.examples && diag.examples.length > 0) {
    const ex = diag.examples[0];
    el.diffBeforeCode.textContent = ex.incorrect || '// Buggy code example';
    el.diffAfterCode.textContent = ex.correct || '// Fixed code example';
    el.diffContainer.style.display = 'block';
  } else {
    el.diffContainer.style.display = 'none';
  }

  // Solutions List
  el.diagSolutionsList.innerHTML = '';
  const solutions = diag.solutions || [];
  solutions.forEach(sol => {
    const li = document.createElement('li');
    li.textContent = sol;
    el.diagSolutionsList.appendChild(li);
  });

  // Verification Checklist
  el.diagChecklist.innerHTML = '';
  const steps = diag.debuggingSteps || ['Verify input parameters', 'Re-run tests'];
  let checkedCount = 0;

  function updateChecklistProgress() {
    el.checklistProgress.textContent = `${checkedCount}/${steps.length}`;
  }

  steps.forEach((stepText, idx) => {
    const item = document.createElement('label');
    item.className = 'checklist-item';
    item.innerHTML = `
      <input type="checkbox" id="chk-${idx}">
      <span>${escapeHtml(stepText)}</span>
    `;
    const chk = item.querySelector('input');
    chk.addEventListener('change', () => {
      if (chk.checked) {
        checkedCount++;
        item.style.textDecoration = 'line-through';
        item.style.opacity = '0.6';
      } else {
        checkedCount--;
        item.style.textDecoration = 'none';
        item.style.opacity = '1';
      }
      updateChecklistProgress();
    });
    el.diagChecklist.appendChild(item);
  });
  updateChecklistProgress();

  // Show Diagnosis Panel
  el.diagnosisContainer.style.display = 'flex';
  el.diagnosisContainer.scrollIntoView({ behavior: 'smooth' });
}

// Codebase Scanner
async function runCodebaseScan() {
  el.btnRunScan.disabled = true;
  el.btnRunScan.textContent = '⏳ Auditing...';
  el.scanSummaryLabel.textContent = 'Scanning files and logs...';

  try {
    const res = await fetch('/api/codebase/scan', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    el.scannerResults.innerHTML = '';
    el.scanSummaryLabel.textContent = `Found ${data.totalIssues} issue(s)`;

    if (data.totalIssues > 0) {
      el.scannerBadge.style.display = 'inline-block';
      el.scannerBadge.textContent = data.totalIssues;

      data.issues.forEach(issue => {
        const card = document.createElement('div');
        card.className = 'scan-issue-card';

        if (issue.sourceType === 'log') {
          const diag = issue.diagnosis;
          card.innerHTML = `
            <div class="scan-issue-top">
              <span class="scan-issue-loc">📜 Log Error in ${escapeHtml(issue.file)}</span>
              <span class="severity-chip severity-${diag.severity || 'high'}">${(diag.severity || 'high').toUpperCase()}</span>
            </div>
            <div style="font-weight: 600; font-size: 13px; color: #fca5a5;">${escapeHtml(diag.errorName)}: ${escapeHtml(diag.message || '')}</div>
            <div style="font-size: 12px; color: var(--text-muted);">${escapeHtml(diag.explanation)}</div>
            <div style="display: flex; gap: 8px; margin-top: 6px;">
              <button class="btn-secondary btn-view-diag" style="font-size: 11px;">🔍 View Full Diagnosis</button>
              <button class="btn-secondary btn-open-file" style="font-size: 11px;">📂 Open Log</button>
            </div>
          `;

          card.querySelector('.btn-view-diag').addEventListener('click', () => {
            renderDiagnosis(diag, issue.raw);
            document.querySelector('[data-tab="tab-runner"]').click();
          });

          card.querySelector('.btn-open-file').addEventListener('click', () => {
            loadFileIntoViewer(issue.file);
          });

        } else {
          // Static code pattern warning
          card.innerHTML = `
            <div class="scan-issue-top">
              <span class="scan-issue-loc">📄 ${escapeHtml(issue.file)}: Line ${issue.line}</span>
              <span class="severity-chip severity-${issue.severity || 'medium'}">${(issue.severity || 'medium').toUpperCase()}</span>
            </div>
            <div style="font-weight: 600; font-size: 13px; color: #fbbf24;">${escapeHtml(issue.category)}</div>
            <div style="font-size: 12px; color: var(--text-muted);">${escapeHtml(issue.message)}</div>
            <div style="display: flex; gap: 8px; margin-top: 6px;">
              <button class="btn-secondary btn-jump-file" style="font-size: 11px;">📂 View Line in Editor</button>
            </div>
          `;

          card.querySelector('.btn-jump-file').addEventListener('click', () => {
            loadFileIntoViewer(issue.file, issue.line);
          });
        }

        el.scannerResults.appendChild(card);
      });
    } else {
      el.scannerBadge.style.display = 'none';
      el.scannerResults.innerHTML = `
        <div style="text-align: center; color: #34d399; padding: 40px;">
          ✨ No runtime crashes or high-risk patterns detected in this codebase!
        </div>
      `;
    }
  } catch (err) {
    alert(`Scan error: ${err.message}`);
  } finally {
    el.btnRunScan.disabled = false;
    el.btnRunScan.innerHTML = '<span>🔍</span> Start Codebase Audit';
  }
}

// Error Sandbox
async function runSandboxAnalysis() {
  const errorText = el.sandboxInput.value.trim();
  if (!errorText) {
    alert('Please enter an error message or stack trace.');
    return;
  }

  el.btnSandboxAnalyze.disabled = true;
  el.btnSandboxAnalyze.textContent = '⏳ Analyzing...';

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: errorText, personality: state.personality })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const diag = data.analysis;
    el.sandboxResult.style.display = 'flex';
    el.sandboxResult.innerHTML = `
      <div class="diag-card">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <strong style="color: #f87171; font-size: 14px;">${escapeHtml(diag.errorName)}</strong>
          <span class="severity-chip severity-${diag.severity || 'high'}">${(diag.severity || 'high').toUpperCase()}</span>
        </div>
        <p style="font-size: 13px; line-height: 1.5; color: var(--text-main);">${escapeHtml(diag.explanation)}</p>
        <p style="font-size: 12px; color: var(--text-muted); margin-top: 6px;">${escapeHtml(diag.whyItHappens)}</p>
      </div>

      <div class="diag-card">
        <div class="diag-card-title">💡 Actionable Solutions</div>
        <ul style="padding-left: 18px; font-size: 13px; line-height: 1.6;">
          ${(diag.solutions || []).map(s => `<li>${escapeHtml(s)}</li>`).join('')}
        </ul>
      </div>
    `;
  } catch (err) {
    alert(`Analysis error: ${err.message}`);
  } finally {
    el.btnSandboxAnalyze.disabled = false;
    el.btnSandboxAnalyze.innerHTML = '<span>🐛</span> Explain Error';
  }
}

// Load Rules
async function loadRules() {
  try {
    const res = await fetch('/api/rules');
    const data = await res.json();
    state.rules = data.rules || [];

    el.rulesGrid.innerHTML = '';
    state.rules.forEach(rule => {
      const card = document.createElement('div');
      card.className = 'diag-card';
      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <strong style="font-size: 13px; color: var(--accent-cyan);">${escapeHtml(rule.name)}</strong>
          <span class="severity-chip severity-${rule.severity || 'medium'}">${(rule.severity || 'medium').toUpperCase()}</span>
        </div>
        <div style="font-family: var(--font-mono); font-size: 11px; color: var(--text-dim); margin-bottom: 6px;">ID: ${escapeHtml(rule.id)}</div>
        <div style="font-size: 12px; color: var(--text-muted); line-height: 1.4;">${escapeHtml(rule.explanation)}</div>
      `;
      el.rulesGrid.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load rules:', err);
  }
}

// Directory Browser for Codebase Selection
async function browseDirectory(dirPath) {
  try {
    const res = await fetch(`/api/codebase/browse?dir=${encodeURIComponent(dirPath)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    el.modalPathInput.value = data.current;
    el.browserItems.innerHTML = '';

    if (data.parent) {
      const upItem = document.createElement('div');
      upItem.className = 'browser-item';
      upItem.innerHTML = `<span>⬆️</span> <strong>.. (Parent Directory)</strong>`;
      upItem.addEventListener('click', () => browseDirectory(data.parent));
      el.browserItems.appendChild(upItem);
    }

    data.dirs.forEach(d => {
      const item = document.createElement('div');
      item.className = 'browser-item';
      item.innerHTML = `<span>📁</span> <span>${escapeHtml(d.name)}</span>`;
      item.addEventListener('click', () => browseDirectory(d.path));
      el.browserItems.appendChild(item);
    });

    data.files.forEach(f => {
      const item = document.createElement('div');
      item.className = 'browser-item';
      item.style.color = 'var(--text-dim)';
      item.innerHTML = `<span>📄</span> <span>${escapeHtml(f.name)}</span>`;
      el.browserItems.appendChild(item);
    });

  } catch (err) {
    alert(`Browse failed: ${err.message}`);
  }
}

// Select Target Codebase
async function selectCodebase(path) {
  try {
    const res = await fetch('/api/codebase/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    state.codebasePath = data.path;
    el.headerCodebasePath.textContent = data.path;
    el.codebaseModal.classList.remove('open');
    await refreshProjectData();
  } catch (err) {
    alert(`Failed to select codebase: ${err.message}`);
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Command execution
  el.btnRunCmd.addEventListener('click', () => {
    const cmd = el.cmdInput.value.trim();
    if (cmd) executeCommand(cmd);
  });

  el.cmdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const cmd = el.cmdInput.value.trim();
      if (cmd) executeCommand(cmd);
    }
  });

  el.btnStopCmd.addEventListener('click', stopRunningCommand);

  el.btnClearTerm.addEventListener('click', () => {
    el.terminalOutput.innerHTML = '';
  });

  el.btnCloseDiag.addEventListener('click', () => {
    el.diagnosisContainer.style.display = 'none';
  });

  // Personality change
  el.personalitySelect.addEventListener('change', async () => {
    const personality = el.personalitySelect.value;
    try {
      await fetch('/api/personality', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personality })
      });
      state.personality = personality;
    } catch (e) {
      console.error(e);
    }
  });

  // Scanner
  el.btnRunScan.addEventListener('click', runCodebaseScan);

  // Sandbox
  el.btnSandboxAnalyze.addEventListener('click', runSandboxAnalysis);

  // Refresh
  el.btnRefreshInfo.addEventListener('click', refreshProjectData);

  // Codebase Modal
  el.btnOpenCodebaseModal.addEventListener('click', () => {
    el.modalPathInput.value = state.codebasePath;
    browseDirectory(state.codebasePath);
    el.codebaseModal.classList.add('open');
  });

  el.btnCloseCodebaseModal.addEventListener('click', () => el.codebaseModal.classList.remove('open'));
  el.btnCancelCodebaseModal.addEventListener('click', () => el.codebaseModal.classList.remove('open'));

  el.btnBrowseDir.addEventListener('click', () => {
    browseDirectory(el.modalPathInput.value.trim());
  });

  el.btnConfirmCodebase.addEventListener('click', () => {
    selectCodebase(el.modalPathInput.value.trim());
  });

  // Presets
  el.presetSampleApp.addEventListener('click', () => {
    el.modalPathInput.value = '/Users/lakshyaramchandani/application_projnpm/sample-codebase';
    browseDirectory(el.modalPathInput.value);
  });

  el.presetNpmPkg.addEventListener('click', () => {
    el.modalPathInput.value = '/Users/lakshyaramchandani/npm package';
    browseDirectory(el.modalPathInput.value);
  });

  el.presetWorkspace.addEventListener('click', () => {
    el.modalPathInput.value = '/Users/lakshyaramchandani/application_projnpm';
    browseDirectory(el.modalPathInput.value);
  });

  // Analyze active file
  el.btnAnalyzeFileContent.addEventListener('click', () => {
    if (state.activeFileContent) {
      el.sandboxInput.value = state.activeFileContent;
      document.querySelector('[data-tab="tab-sandbox"]').click();
      runSandboxAnalysis();
    }
  });

  // Copy Markdown Report
  el.btnCopyReport.addEventListener('click', () => {
    if (!state.activeDiagnosis) return;
    const diag = state.activeDiagnosis;
    const md = `### 🐛 Bug Whisperer Diagnostic Report
- **Error**: \`${diag.errorName}\`
- **Severity**: ${diag.severity}
- **Confidence**: ${Math.round((diag.confidence || 0.95) * 100)}%
- **Location**: ${diag.location?.file || 'N/A'}:${diag.location?.line || ''}

#### 📖 Explanation
${diag.explanation}

#### 💡 Recommended Solutions
${(diag.solutions || []).map(s => `- ${s}`).join('\n')}

#### ✅ Verification Checklist
${(diag.debuggingSteps || []).map(s => `- [ ] ${s}`).join('\n')}
`;
    navigator.clipboard.writeText(md).then(() => {
      alert('Markdown report copied to clipboard!');
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Start
init();
