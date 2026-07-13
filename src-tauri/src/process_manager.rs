// Epi - Local-first Meeting Intelligence
// Copyright (C) 2026  Eike Christian Karbe
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
//

use std::collections::HashMap;
use std::sync::Mutex;
use std::process::{Child, Command, Output};
use std::io::copy;
use std::thread;

/// Thread-safe registry that keeps track of active child processes spawned by Tauri.
/// Allows clean resource cleanup on application exit to prevent orphan background processes.
pub struct ProcessRegistry {
    /// A map of active child process IDs to their respective `Child` handles.
    pub processes: Mutex<HashMap<u32, Child>>,
}

impl Default for ProcessRegistry {
    fn default() -> Self {
        Self {
            processes: Mutex::new(HashMap::new()),
        }
    }
}

impl ProcessRegistry {
    /// Creates a new empty `ProcessRegistry`.
    pub fn new() -> Self {
        Self::default()
    }

    /// Kills all registered child processes and blocks until their status is resolved.
    ///
    /// # Side Effects
    /// * Iterates through all registered child processes, sending SIGKILL/kill,
    ///   and waits for each process to terminate.
    pub fn kill_all(&self) {
        let mut lock = self.processes.lock().unwrap_or_else(|e| e.into_inner());
        for (pid, mut child) in lock.drain() {
            println!("[ProcessRegistry] Killing process {}", pid);
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

/// Spawns a background command, registers its PID in the process registry,
/// and returns its standard stdout and stderr output streams asynchronously.
///
/// # Arguments
/// * `registry` - A reference to the process registry tracking child processes.
/// * `cmd` - The prepared Command structure ready to be spawned.
///
/// # Returns
/// * `Result<Output, String>` - The complete command execution outputs or error message.
///
/// # Side Effects
/// * Spawns the child process and inserts its PID/handle into the registry.
/// * Spawns stdout/stderr reader threads to copy piped outputs to avoid blocking the OS buffer stream.
pub fn run_registered(registry: &ProcessRegistry, mut cmd: Command) -> Result<Output, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }

    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());
    
    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn process: {}", e))?;
    let pid = child.id();
    
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;
    
    {
        let mut lock = registry.processes.lock().unwrap_or_else(|e| e.into_inner());
        lock.insert(pid, child);
    }
    
    // Copy stdout to prevent internal buffers from saturating and freezing the process
    let stdout_thread = thread::spawn(move || {
        let mut buf = Vec::new();
        let mut reader = stdout;
        let _ = copy(&mut reader, &mut buf);
        buf
    });
    
    // Copy stderr to prevent internal buffers from saturating
    let stderr_thread = thread::spawn(move || {
        let mut buf = Vec::new();
        let mut reader = stderr;
        let _ = copy(&mut reader, &mut buf);
        buf
    });
    
    let stdout_res = stdout_thread.join().unwrap_or_default();
    let stderr_res = stderr_thread.join().unwrap_or_default();
    
    let child = {
        let mut lock = registry.processes.lock().unwrap_or_else(|e| e.into_inner());
        lock.remove(&pid)
    };
    
    if let Some(mut c) = child {
        let status = c.wait().map_err(|e| format!("Failed to wait for process: {}", e))?;
        Ok(Output {
            status,
            stdout: stdout_res,
            stderr: stderr_res,
        })
    } else {
        Err("Process was terminated during exit cleanup".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_registry_lifecycle() {
        let registry = ProcessRegistry::new();
        assert!(registry.processes.lock().unwrap().is_empty());
    }

    #[test]
    fn test_run_registered_success() {
        let registry = ProcessRegistry::new();
        let mut cmd = Command::new("echo");
        cmd.arg("hello world");
        
        let output = run_registered(&registry, cmd).expect("Failed to run echo command");
        assert!(output.status.success());
        let stdout_str = String::from_utf8_lossy(&output.stdout);
        assert!(stdout_str.contains("hello world"));
    }
    
    #[test]
    fn test_run_registered_invalid_cmd() {
        let registry = ProcessRegistry::new();
        let cmd = Command::new("this-command-does-not-exist-12345");
        let result = run_registered(&registry, cmd);
        assert!(result.is_err());
    }
}
