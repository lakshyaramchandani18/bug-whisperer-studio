# 🐛 Bug Whisperer Studio

> **Codebase Debugging & Diagnostics Studio**  
> Powered by the local [`bug-whisperer`](/Users/lakshyaramchandani/npm%20package) npm package.

`Bug Whisperer Studio` is a developer-focused interactive application that allows you to select any codebase directory on your machine, inspect its files and logs, run commands and test suites, and automatically intercept runtime errors and stack traces using the deterministic `bug-whisperer` knowledge engine.

---

## ⚡ Key Capabilities

1. **📁 Dynamic Codebase Selector**:
   - Seamlessly switch between any project directory on your machine.
   - Built-in directory browser and one-click presets (Sample Buggy Project, NPM Package directory, Current workspace).
   - Auto-detects `package.json`, project metadata, scripts, runnable files, and log files.

2. **🚀 Interactive Runner & Error Interceptor**:
   - Run any npm script (`npm test`, `npm start`, etc.) or custom command directly from the studio.
   - Real-time terminal output streaming with full ANSI color support over WebSockets.
   - **Automatic Interception**: When a process fails or emits an unhandled error, `bug-whisperer` instantly generates:
     - Plain-English root cause explanation
     - Severity badge & confidence score
     - Mentor voice commentary (`friendly`, `professional`, `funny`, `strict`)
     - Exact source file location jump
     - Before & After visual code diff
     - Interactive verification checklist

3. **🔍 Codebase & Log Health Scanner**:
   - Recursively scans `.log` files in the target codebase for crash logs and unhandled rejections.
   - Audits JavaScript/TypeScript code for runtime pitfalls (uninitialized variables, constant reassignments, unhandled promises).

4. **📄 In-Studio Code & Log Inspector**:
   - Inspect files from the selected codebase with line numbering and highlighted error lines.
   - One-click trigger to analyze file contents.

5. **🧪 Instant Error Sandbox**:
   - Test any raw error message or stack trace directly against `bug-whisperer`.

6. **🧩 Rules Engine Explorer**:
   - Inspect all built-in deterministic rules and add custom domain-specific rules on the fly.

---

## 🛠️ Quick Start

### 1. Start the Studio

```bash
cd /Users/lakshyaramchandani/application_projnpm
npm start
```

Open your browser at **`http://localhost:3030`**.

### 2. Immediate Testing with Bundled Sample Project

The Studio comes pre-configured with a sample project at `./sample-codebase` containing realistic scenarios:
- **`npm run bug:typeerror`**: Triggers `TypeError: Cannot read properties of undefined`
- **`npm run bug:reference`**: Triggers `ReferenceError: fetchProfileData is not defined`
- **`npm run bug:constant`**: Triggers `TypeError: Assignment to constant variable`
- **`npm run test`**: Executes unit test suite failing with stack trace
- **`sample-codebase/logs/error.log`**: Sample production crash logs for the scanner to inspect

---

## 🔗 NPM Package Link

The studio links directly to the local npm package at:
```
/Users/lakshyaramchandani/npm package
```
Any improvements or rule changes made in the npm package directory are reflected immediately in Bug Whisperer Studio!
