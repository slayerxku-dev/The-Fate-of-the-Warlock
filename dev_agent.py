import os
import json
import requests

PROJECT_PATH = r"d:\Development\The Fate of the Warlock"

GAME_JS_PATH = os.path.join(PROJECT_PATH, "game.js")
ROADMAP_PATH = os.path.join(PROJECT_PATH, "roadmap.json")

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
        print(f"Brace mismatch: {{: {code.count('{')}, }}: {code.count('}')}")
        return False
    return "const state =" in code or "function" in code

def run_agent_cycle():
    with open(ROADMAP_PATH, 'r') as f:
        roadmap = json.load(f)

    if not roadmap['pending_tasks']:
        if roadmap.get('future_tasks'):
            print("Pending tasks empty. Pulling next task from future_tasks...")
            roadmap['pending_tasks'].append(roadmap['future_tasks'].pop(0))
        else:
            print("No tasks in roadmap. Development idle.")
            return

    task = roadmap['pending_tasks'][0]
    # Determine target file (default to engine.js if not specified)
    target_file = task.get("file", "js/engine.js")
    target_path = os.path.join(PROJECT_PATH, target_file)
    
    print(f"Agent starting task: {task['description']} on {target_file}")

    with open(target_path, 'r') as f:
        current_code = f.read()

    # Prompt Construction
    system_prompt = "You are a world-class Game Developer AI. Your goal is to provide the ENTIRE contents of a file after modifying it. You must ensure NO code is missing or truncated."
    
    prompt = f"""### TASK
    {task['description']}
    
    ### CURRENT FILE CONTENT
    ```javascript
    {current_code}
    ```
    
    ### INSTRUCTIONS
    1. Modify the code to implement the task.
    2. Return the COMPLETE file content. Do NOT use "..." or "rest of code remains the same".
    3. Ensure all brackets and parentheses are balanced.
    4. Maintain the existing architectural style.
    5. Output ONLY the code. No explanations.
    
    ### OUTPUT FORMAT
    Provide the full file content below:"""

    # Generate Code
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
        new_code = response.json().get("response", "").strip()

        # Clean markdown formatting if present
        if "```" in new_code:
            new_code = new_code.split("```")[1]
            if new_code.lower().startswith("javascript"): new_code = new_code[10:]
            elif new_code.lower().startswith("js"): new_code = new_code[2:]
            new_code = new_code.strip()
            
    except Exception as e:
        print(f"Error during Local LLM call: {e}. Ensure Ollama is running and qwen2.5-coder:7b is pulled.")
        return

    # Simple validation: Check if basic functions still exist
    if is_syntax_valid(new_code):
        create_backup(GAME_JS_PATH)
        # Save the new code
        with open(GAME_JS_PATH, 'w') as f:
            f.write(new_code)
        
        # Update roadmap
        completed_task = roadmap['pending_tasks'].pop(0)
        roadmap['completed_tasks'].append(completed_task)
        
        with open(ROADMAP_PATH, 'w') as f:
            json.dump(roadmap, f, indent=4)
            
        print(f"Task {task['id']} completed and code updated.")
    else:
        print("Agent generated invalid code. Reverting.")

if __name__ == "__main__":
    # This could be put on a timer or triggered via a GitHub Action
    run_agent_cycle()