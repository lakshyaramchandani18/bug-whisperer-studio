/**
 * @fileoverview Bug Whisperer Studio Server
 * Full-stack backend providing Codebase Diagnostics, Interactive Runner,
 * Live Terminal WebSocket Streaming, and Integration with the local bug-whisperer npm package.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';

// Import bug-whisperer directly from the local package link
import {
  BugWhisperer,
  Personality,
  OutputFormat,
  Severity,
  analyzeError,
  explainError
} from 'bug-whisperer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3030;
const NPM_PACKAGE_PATH = '/Users/lakshyaramchandani/npm package';
const DEFAULT_CODEBASE = path.join(__dirname, 'sample-codebase');

// App State
let currentCodebasePath = DEFAULT_CODEBASE;
let currentPersonality = Personality.FRIENDLY;
let activeProcess = null;

// Initialize Bug Whisperer instance
const whisperer = new BugWhisperer({
  personality: currentPersonality
});

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Create HTTP Server & WebSocket Server
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

// Active WebSocket connections
const wsClients = new Set();

wss.on('connection', (ws) => {
  wsClients.add(ws);

  ws.send(JSON.stringify({
    type: 'init',
    data: {
      codebasePath: currentCodebasePath,
      packagePath: NPM_PACKAGE_PATH,
      personality: currentPersonality
    }
  }));

  ws.on('close', () => wsClients.delete(ws));
});

function broadcast(msg) {
  const payload = JSON.stringify(msg);
  for (const client of wsClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

// ==========================================
// API ROUTES
// ==========================================

// 1. Status & Configuration
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    codebasePath: currentCodebasePath,
    packagePath: NPM_PACKAGE_PATH,
    personality: currentPersonality,
    availablePersonalities: Object.values(Personality),
    ruleCount: whisperer.getRules().length
  });
});

// Update Personality
app.post('/api/personality', (req, res) => {
  const { personality } = req.body;
  if (personality && Object.values(Personality).includes(personality)) {
    currentPersonality = personality;
    whisperer.setPersonality(personality);
    broadcast({ type: 'personality_changed', personality });
    return res.json({ success: true, personality: currentPersonality });
  }
  res.status(400).json({ error: 'Invalid personality' });
});

// 2. Codebase Selection & Browsing
app.post('/api/codebase/select', (req, res) => {
  const targetPath = req.body.path?.trim();
  if (!targetPath) {
    return res.status(400).json({ error: 'Path is required' });
  }

  const resolved = path.resolve(targetPath);
  try {
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'Provided path is not a directory' });
    }
    currentCodebasePath = resolved;
    broadcast({ type: 'codebase_changed', path: currentCodebasePath });
    res.json({ success: true, path: currentCodebasePath });
  } catch (err) {
    res.status(400).json({ error: `Directory not accessible: ${err.message}` });
  }
});

// Browse Directories for Picker
app.get('/api/codebase/browse', (req, res) => {
  const dirPath = req.query.dir ? path.resolve(req.query.dir) : currentCodebasePath;
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const parent = path.dirname(dirPath);
    const dirs = [];
    const files = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.env') continue;
      if (entry.name === 'node_modules') continue;

      if (entry.isDirectory()) {
        dirs.push({ name: entry.name, path: path.join(dirPath, entry.name) });
      } else {
        files.push({ name: entry.name, path: path.join(dirPath, entry.name) });
      }
    }

    dirs.sort((a, b) => a.name.localeCompare(b.name));
    files.sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      current: dirPath,
      parent: parent !== dirPath ? parent : null,
      dirs,
      files
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Codebase Info & Detected Scripts
app.get('/api/codebase/info', (req, res) => {
  try {
    const pkgPath = path.join(currentCodebasePath, 'package.json');
    let pkg = null;
    let scripts = {};

    if (fs.existsSync(pkgPath)) {
      try {
        pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        scripts = pkg.scripts || {};
      } catch (e) {
        // invalid JSON
      }
    }

    // Scan for JS runnable files if no scripts found
    const files = fs.readdirSync(currentCodebasePath);
    const runnableFiles = files.filter(f => /\.(js|mjs|cjs|ts)$/.test(f));
    const logFiles = [];

    // Search for .log files recursively up to 2 levels
    function findLogs(dir, depth = 0) {
      if (depth > 2) return;
      try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        for (const item of items) {
          if (item.name === 'node_modules' || item.name.startsWith('.')) continue;
          const full = path.join(dir, item.name);
          if (item.isDirectory()) {
            findLogs(full, depth + 1);
          } else if (item.name.endsWith('.log')) {
            const rel = path.relative(currentCodebasePath, full);
            logFiles.push({ name: item.name, relativePath: rel, fullPath: full });
          }
        }
      } catch (e) {}
    }

    findLogs(currentCodebasePath);

    res.json({
      path: currentCodebasePath,
      name: pkg?.name || path.basename(currentCodebasePath),
      version: pkg?.version || '1.0.0',
      description: pkg?.description || 'Codebase under inspection',
      packageJson: pkg,
      scripts,
      runnableFiles,
      logFiles
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Codebase Directory Tree
app.get('/api/codebase/tree', (req, res) => {
  function getTree(dir, depth = 0) {
    if (depth > 4) return null;
    const items = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.env') continue;
        if (entry.name === 'node_modules') continue;

        const full = path.join(dir, entry.name);
        const rel = path.relative(currentCodebasePath, full);

        if (entry.isDirectory()) {
          const children = getTree(full, depth + 1);
          items.push({
            name: entry.name,
            path: rel,
            type: 'dir',
            children: children || []
          });
        } else {
          items.push({
            name: entry.name,
            path: rel,
            type: 'file',
            ext: path.extname(entry.name).toLowerCase(),
            size: fs.statSync(full).size
          });
        }
      }
    } catch (e) {}
    return items;
  }

  res.json({
    root: path.basename(currentCodebasePath),
    tree: getTree(currentCodebasePath)
  });
});

// Read File Content
app.get('/api/codebase/file', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: 'path is required' });

  const resolved = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(currentCodebasePath, filePath);

  try {
    const content = fs.readFileSync(resolved, 'utf8');
    const lines = content.split('\n');
    res.json({
      path: filePath,
      fullPath: resolved,
      content,
      lineCount: lines.length,
      ext: path.extname(resolved).toLowerCase()
    });
  } catch (err) {
    res.status(404).json({ error: `File not found: ${err.message}` });
  }
});

// 3. Error Analysis via Bug Whisperer
app.post('/api/analyze', (req, res) => {
  const { error, personality } = req.body;
  if (!error || typeof error !== 'string') {
    return res.status(400).json({ error: 'error payload must be a string' });
  }

  const selectedVoice = personality || currentPersonality;

  try {
    const analysis = whisperer.analyze(error, { personality: selectedVoice });
    const terminalOutput = whisperer.explain(error, {
      format: OutputFormat.TERMINAL,
      personality: selectedVoice
    });
    const markdownOutput = whisperer.explain(error, {
      format: OutputFormat.MARKDOWN,
      personality: selectedVoice
    });

    res.json({
      success: true,
      analysis,
      terminalOutput,
      markdownOutput
    });
  } catch (err) {
    res.status(500).json({ error: `Analysis failed: ${err.message}` });
  }
});

// 4. Codebase Static & Log Scanner
app.post('/api/codebase/scan', (req, res) => {
  const issues = [];

  try {
    // 1. Scan for Log Files and parse any recorded errors
    function scanDir(dir, depth = 0) {
      if (depth > 3) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        const full = path.join(dir, entry.name);
        const rel = path.relative(currentCodebasePath, full);

        if (entry.isDirectory()) {
          scanDir(full, depth + 1);
        } else if (entry.name.endsWith('.log')) {
          // Parse log file for error traces
          const content = fs.readFileSync(full, 'utf8');
          const errorRegex = /(?:TypeError|ReferenceError|SyntaxError|RangeError|URIError|Error):[^\n]+(?:\n\s+at[^\n]+)*/g;
          const matches = content.match(errorRegex) || [];

          for (const match of matches) {
            const diagnosis = whisperer.analyze(match, { personality: currentPersonality });
            issues.push({
              sourceType: 'log',
              file: rel,
              raw: match.slice(0, 300),
              diagnosis
            });
          }
        } else if (/\.(js|mjs|cjs|ts)$/.test(entry.name)) {
          // Static Code Pattern Warnings
          const code = fs.readFileSync(full, 'utf8');
          const lines = code.split('\n');

          lines.forEach((line, index) => {
            const lineNum = index + 1;

            // Pattern 1: Potential undefined dereference (e.g. payload.token without check)
            if (/const \w+ = undefined;/.test(line) || /let \w+ = undefined;/.test(line)) {
              issues.push({
                sourceType: 'code',
                file: rel,
                line: lineNum,
                category: 'Uninitialized Variable',
                severity: 'medium',
                message: `Variable initialized to undefined: '${line.trim()}'. Subsequent property reads may throw TypeError.`
              });
            }

            // Pattern 2: Assignment to const
            if (/^const\s+(\w+)\s*=/.test(line.trim())) {
              const varName = line.trim().match(/^const\s+(\w+)\s*=/)?.[1];
              if (varName) {
                // Check if re-assigned later
                const reassignRegex = new RegExp(`^\\s*${varName}\\s*=[^=]`, 'm');
                const remainder = lines.slice(index + 1).join('\n');
                if (reassignRegex.test(remainder)) {
                  issues.push({
                    sourceType: 'code',
                    file: rel,
                    line: lineNum,
                    category: 'Constant Reassignment',
                    severity: 'high',
                    message: `Constant '${varName}' declared here is reassigned later in file, triggering TypeError: Assignment to constant variable.`
                  });
                }
              }
            }

            // Pattern 3: JSON.parse without try/catch
            if (/JSON\.parse\(/.test(line) && !/try\s*\{/.test(lines[Math.max(0, index - 2)] || '')) {
              issues.push({
                sourceType: 'code',
                file: rel,
                line: lineNum,
                category: 'Unsafe JSON Parse',
                severity: 'low',
                message: `JSON.parse called without nearby try/catch block. Malformed JSON will throw unhandled SyntaxError.`
              });
            }
          });
        }
      }
    }

    scanDir(currentCodebasePath);

    res.json({
      success: true,
      totalIssues: issues.length,
      issues
    });
  } catch (err) {
    res.status(500).json({ error: `Scan failed: ${err.message}` });
  }
});

// 5. Interactive Script Runner with Error Interception
app.post('/api/runner/execute', (req, res) => {
  const { command, scriptName } = req.body;
  const cmd = command || (scriptName ? `npm run ${scriptName}` : 'npm test');

  if (activeProcess) {
    return res.status(409).json({ error: 'A process is already running. Please stop it first.' });
  }

  broadcast({ type: 'run_start', command: cmd, cwd: currentCodebasePath });

  let stdoutBuffer = '';
  let stderrBuffer = '';

  try {
    const child = spawn(cmd, {
      shell: true,
      cwd: currentCodebasePath,
      env: { ...process.env, FORCE_COLOR: '1' }
    });

    activeProcess = child;

    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdoutBuffer += text;
      broadcast({ type: 'stdout', text });
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderrBuffer += text;
      broadcast({ type: 'stderr', text });
    });

    child.on('close', (code) => {
      activeProcess = null;
      broadcast({ type: 'run_exit', code, command: cmd });

      // Automatically inspect for errors if process failed or stderr contains stack traces
      const combined = stderrBuffer + '\n' + stdoutBuffer;
      const hasError = code !== 0 || /(?:TypeError|ReferenceError|SyntaxError|RangeError|Error):/.test(combined);

      let diagnosis = null;
      if (hasError) {
        try {
          // Extract the most relevant error chunk
          const errorMatch = combined.match(/(?:(?:TypeError|ReferenceError|SyntaxError|RangeError|URIError|Error):[^\n]+(?:\n\s+at[^\n]+)*)/);
          const errorToAnalyze = errorMatch ? errorMatch[0] : (stderrBuffer.trim() || combined.trim());

          if (errorToAnalyze) {
            diagnosis = whisperer.analyze(errorToAnalyze, { personality: currentPersonality });
            broadcast({
              type: 'diagnosis_ready',
              diagnosis,
              rawError: errorToAnalyze
            });
          }
        } catch (e) {
          console.error('Diagnosis generation failed:', e);
        }
      }
    });

    res.json({ success: true, started: true, command: cmd });
  } catch (err) {
    activeProcess = null;
    res.status(500).json({ error: `Failed to execute: ${err.message}` });
  }
});

// Stop Running Process
app.post('/api/runner/kill', (req, res) => {
  if (activeProcess) {
    try {
      activeProcess.kill('SIGTERM');
      activeProcess = null;
      broadcast({ type: 'run_killed' });
      return res.json({ success: true, killed: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
  res.json({ success: true, running: false });
});

// 6. Rules Management
app.get('/api/rules', (req, res) => {
  res.json({
    rules: whisperer.getRules()
  });
});

app.post('/api/rules', (req, res) => {
  const { id, name, pattern, explanation, causes, solutions, checklist, severity } = req.body;
  if (!id || !name || !pattern) {
    return res.status(400).json({ error: 'id, name, and pattern are required' });
  }

  try {
    whisperer.addRule({
      id,
      name,
      pattern: new RegExp(pattern, 'i'),
      explanation: explanation || 'Custom domain rule triggered',
      causes: causes || [],
      solutions: solutions || [],
      checklist: checklist || [],
      severity: severity || Severity.HIGH
    });

    res.json({ success: true, ruleId: id });
  } catch (err) {
    res.status(400).json({ error: `Failed to add rule: ${err.message}` });
  }
});

// Start Server
server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Bug Whisperer Studio running at http://localhost:${PORT}`);
  console.log(`📁 Active Codebase: ${currentCodebasePath}`);
  console.log(`📦 NPM Package Linked: ${NPM_PACKAGE_PATH}`);
  console.log(`======================================================\n`);
});
