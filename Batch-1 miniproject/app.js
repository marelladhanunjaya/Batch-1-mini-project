// app.js

document.addEventListener('DOMContentLoaded', () => {

    // Initialize CodeMirror editor
    const editor = CodeMirror(document.getElementById('editor-container'), {
        mode: 'text/x-csrc',
        lineNumbers: true,
        tabSize: 4,
        indentWithTabs: false
    });

    const checkButton = document.getElementById('checkButton');
    const resultDiv = document.getElementById('result');
    const body = document.body; // Reference to the body element

    // Example C program with intentional errors for demonstration
    const exampleCode = `#include <stdio.h>

it main() {
    int x = 10;
    char y = 'A'; 
    
    // Incorrect datatype assignment
    x = "Hello"; 
    
    // Invalid operation between different types
    int z = x + y; 
    
    // Valid assignment
    int a = 20;

    return 0;
}`;

    editor.setValue(exampleCode);

    checkButton.addEventListener('click', () => {
        const code = editor.getValue();
        resultDiv.innerHTML = '';
        
        const syntaxErrors = findSyntaxErrors(code);

        if (syntaxErrors.length > 0) {
            resultDiv.innerHTML = `<span class="error">Syntax Errors Found:</span><br>${syntaxErrors.join('<br>')}`;
            // Change background to red if errors are found
            body.style.transition = 'background-color 0.3s ease-in-out';
            body.style.backgroundColor = '#ff4d4d';
        } else {
            resultDiv.innerHTML = '<span class="success">Syntax is valid! ✅</span>';
            // Change background to green if no errors are present
            body.style.transition = 'background-color 0.3s ease-in-out';
            body.style.backgroundColor = '#4CAF50';
        }

        // Revert background color after 3 seconds
        setTimeout(() => {
            body.style.backgroundColor = 'var(--bg-color)';
        }, 1500); // 1500 milliseconds = 1.5 seconds
    });

    /**
     * Finds common C syntax and basic datatype errors by analyzing the code line-by-line.
     * @param {string} code - The C code to check.
     * @returns {string[]} An array of detected issues.
     */
    function findSyntaxErrors(code) {
        const errors = [];
        const lines = code.split('\n');
        
        const cKeywords = [
            "auto", "break", "case", "char", "const", "continue", "default", "do", "double", "else", 
            "enum", "extern", "float", "for", "goto", "if", "int", "long", "register", "return", 
            "short", "signed", "sizeof", "static", "struct", "switch", "typedef", "union", 
            "unsigned", "void", "volatile", "while", "_Bool", "_Complex", "_Imaginary", "restrict", "inline"
        ];
        const dataTypes = ["int", "char", "float", "double", "void", "long", "short", "signed", "unsigned"];

        const symbolTable = {};
        const braceStack = [];
        let hasMain = false;
        let hasReturn = false;
        let currentScope = 'global';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lineNumber = i + 1;
            const trimmedLine = line.trim();
            const codePart = trimmedLine.split('//')[0].trim();

            if (trimmedLine.length === 0 || trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
                continue;
            }

            // Brace and parenthesis checking
            for (const char of line) {
                if (char === '{') {
                    braceStack.push('{');
                } else if (char === '}') {
                    if (braceStack.pop() !== '{') {
                        errors.push(`Line ${lineNumber}: Unmatched '}'.`);
                    }
                } else if (char === '(') {
                    braceStack.push('(');
                } else if (char === ')') {
                    if (braceStack.pop() !== '(') {
                        errors.push(`Line ${lineNumber}: Unmatched ')'.`);
                    }
                }
            }
            
            // Preprocessor directives check
            if (trimmedLine.startsWith('#')) {
                if (!trimmedLine.match(/^#include\s+<.*>$/)) {
                    errors.push(`Line ${lineNumber}: Invalid preprocessor directive.`);
                }
                continue;
            }

            // Main function and return keyword validation
            const functionDefMatch = codePart.match(/^(\w+)\s+main\s*\(.*\)\s*\{/);
            if (functionDefMatch) {
                hasMain = true;
                const returnType = functionDefMatch[1];
                if (returnType !== 'int' && returnType !== 'void') {
                    errors.push(`Line ${lineNumber}: The 'main' function must have a return type of 'int' or 'void'. Found '${returnType}'.`);
                }
                currentScope = 'main';
            } else if (codePart.includes('return')) {
                hasReturn = true;
                if (currentScope !== 'main' && currentScope !== 'global') {
                     // In a real parser, we would track function scope more accurately.
                     // For this simple checker, we assume 'return' is only valid in main.
                    errors.push(`Line ${lineNumber}: 'return' statement should be in the 'main' function.`);
                }
            } else if (trimmedLine.endsWith('}')) {
                if (currentScope === 'main') {
                    currentScope = 'global';
                }
            }

            // Semicolon check
            if (codePart.length > 0 && !codePart.endsWith(';') && !codePart.endsWith('{') && !codePart.endsWith('}') && !codePart.match(/if|for|while|switch/)) {
                 if (!codePart.match(/^\w+\s+\w+\s*\(.*\)\s*$/)) {
                    errors.push(`Line ${lineNumber}: Missing semicolon (';') at the end of the line.`);
                }
            }

            // Datatype declaration and validation
            const declarationMatch = codePart.match(/^(int|char|float|double)\s+(\w+)\s*(=?.*);?$/);
            if (declarationMatch) {
                const type = declarationMatch[1];
                const variableName = declarationMatch[2];
                symbolTable[variableName] = type;
            } else {
                const potentialType = codePart.split(/\s+/)[0];
                if (isIdentifier(potentialType) && !dataTypes.includes(potentialType) && !cKeywords.includes(potentialType) && potentialType !== "main" && !codePart.includes('#')) {
                    const declarationPattern = /^\w+\s+\w+\s*(=?.*);?$/;
                    if (declarationPattern.test(codePart) && !codePart.includes('main')) {
                        errors.push(`Line ${lineNumber}: Unrecognized datatype or variable declaration '${potentialType}'.`);
                    }
                }
            }

            // Variable assignment checks
            const assignmentMatch = codePart.match(/^(\w+)\s*=\s*(.*);?$/);
            if (assignmentMatch) {
                const variableName = assignmentMatch[1];
                const assignedValue = assignmentMatch[2].trim();

                if (symbolTable[variableName]) {
                    const expectedType = symbolTable[variableName];
                    let assignedType = null;
                    if (assignedValue.match(/^-?\d+$/)) {
                        assignedType = 'int';
                    } else if (assignedValue.match(/^-?\d+\.\d+f?$/)) {
                        assignedType = 'float';
                    } else if (assignedValue.match(/^'.*'$/)) {
                        assignedType = 'char';
                    } else if (assignedValue.match(/^".*"$/)) {
                        assignedType = 'string';
                    } else if (symbolTable[assignedValue]) {
                        assignedType = symbolTable[assignedValue];
                    }

                    if (assignedType !== null && expectedType !== assignedType) {
                        if (!(assignedType === 'int' && expectedType === 'char') && !(assignedType === 'char' && expectedType === 'int')) {
                            errors.push(`Line ${lineNumber}: Mismatched types. Variable '${variableName}' of type '${expectedType}' cannot be assigned a value of type '${assignedType}'.`);
                        }
                    }
                }
            }
        }
        
        // Final checks for the entire program
        if (!hasMain) {
            errors.push("Missing a valid 'main' function declaration.");
        }
        if (hasMain && !hasReturn) {
            errors.push("The 'main' function should have a 'return' statement.");
        }
        if (braceStack.length > 0) {
            errors.push('Unmatched opening brace, parenthesis, or bracket.');
        }

        return errors;
    }
    
    function isIdentifier(word) {
        return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(word);
    }
});