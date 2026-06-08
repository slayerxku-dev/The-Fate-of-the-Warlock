import os
import json
import requests
from datetime import datetime
import time

PROJECT_PATH = r"d:\Development\The Fate of the Warlock"
ROADMAP_PATH = os.path.join(PROJECT_PATH, "roadmap.json")
DEVLOG_PATH = os.path.join(PROJECT_PATH, "devlog.txt")

def create_backup(file_path):
    """Create a timestamped backup of the file before modification."""
    if not os.path.exists(file_path): return
    backup_dir = os.path.join(PROJECT_PATH, "backups")
    os.makedirs(backup_dir, exist_ok=True)
    filename = os.path.basename(file_path)
    backup_path = os.path.join(backup_dir, f"{filename}.bak")
    with open(file_path, 'r') as src, open(backup_path, 'w') as dst:
        dst.write(src.read())

def is_syntax_valid(code):
    """Perform a basic structural check on the generated JavaScript."""
    if not code or len(code) < 100: return False
    # Basic bracket balancing check
    if code.count('{') != code.count('}') or code.count('(') != code.count(')'):
        return False
    # Check for general JS markers
    return "const " in code or "function" in code or "state" in code

def run_agent_cycle():
    # Load roadmap
    with open(ROADMAP_PATH, 'r') as f:
        roadmap = json.load(f)

    if not roadmap['pending_tasks']:
        if roadmap.get('future_tasks'):
            print("Pulling next task from future_tasks...")
            roadmap['pending_tasks'].append(roadmap['future_tasks'].pop(0))
        else:
            print("No tasks in roadmap. Development idle.")
            return False

    task = roadmap['pending_tasks'][0]
    target_file = task.get("file", "js/engine.js")
    target_path = os.path.join(PROJECT_PATH, target_file)
    
    print(f"Agent starting task: {task['id']} on {target_file}")

    with open(target_path, 'r') as f:
        current_code = f.read()

    # Enhanced Prompt
    system_prompt = (
        "You are a world-class Game Developer AI. Your goal is to provide the ENTIRE contents of a file after modifying it. "
        "At the very end of your response, after the code, provide a one-sentence summary of your changes starting with '---SUMMARY---'."
    )
    
    prompt = f"""### TASK
    {task['description']}
    
    ### CURRENT FILE CONTENT ({target_file})
    ```javascript
    {current_code}
    ```
    
    ### INSTRUCTIONS
    1. Modify the code to implement the task.
    2. Return the COMPLETE file content. 
    3. After the code, add '---SUMMARY---' followed by a short summary.
    """

    # Generate Code via Ollama
    try:
        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "qwen2.5-coder:7b",
                "system": system_prompt,
                "prompt": prompt,
                "options": {
                    "num_ctx": 8192,
                    "temperature": 0.2,
                    "num_predict": 4096
                },
                "stream": False
            }
        )
        response.raise_for_status()
        full_response = response.json().get("response", "").strip()

        # Parse code and summary
        if "---SUMMARY---" in full_response:
            parts = full_response.split("---SUMMARY---")
            raw_code = parts[0].strip()
            summary = parts[1].strip()
        else:
            raw_code = full_response
            summary = "No summary provided by AI."

        # Clean markdown backticks
        if "```" in raw_code:
            code_parts = raw_code.split("```")
            new_code = code_parts[1]
            if new_code.lower().startswith("javascript"): new_code = new_code[10:]
            elif new_code.lower().startswith("js"): new_code = new_code[2:]
            new_code = new_code.strip()
        else:
            new_code = raw_code

    except Exception as e:
        print(f"Error during Local LLM call: {e}")
        return False

    # Validation and Saving
    if is_syntax_valid(new_code):
        create_backup(target_path)
        with open(target_path, 'w') as f:
            f.write(new_code)
        
        # Log to devlog.txt
        with open(DEVLOG_PATH, "a") as log_file:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            log_file.write(f"[{timestamp}] Task {task['id']} ({target_file}): {summary}\n")
            
        # Update roadmap
        completed_task = roadmap['pending_tasks'].pop(0)
        roadmap['completed_tasks'].append(completed_task)
        with open(ROADMAP_PATH, 'w') as f:
            json.dump(roadmap, f, indent=4)
        
        print(f"Success! {task['id']} logged to devlog.txt")
        return True
    else:
        print("Agent generated invalid code. Reverting.")
        return False

if __name__ == "__main__":
    print("Starting Autonomous Development Loop...")
    try:
        while True:
            if not run_agent_cycle():
                break
            print("\n--- Cycle Complete. Starting next task in 2 seconds... ---\n")
            time.sleep(2)
    except KeyboardInterrupt:
        print("\n[Interrupt Received] Shutting down gracefully...")
        print("Current task state has been preserved in roadmap.json.")
