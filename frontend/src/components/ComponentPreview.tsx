'use client';

import { useEffect, useRef } from 'react';

// Define the shape of the code object we expect
interface GeneratedCode {
  jsx: string;
  css: string;
}

// This component will receive the generated code as a prop
export default function ComponentPreview({ code }: { code: GeneratedCode | null }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Only update the iframe if there is code to render
    if (iframeRef.current && code) {
      const iframeDoc = iframeRef.current.contentDocument;
      if (iframeDoc) {
        // Transpile the JSX string into plain JavaScript
        const transpiledJsx = (window as any).Babel.transform(code.jsx, {
          presets: ['react'],
        }).code;

        // This is the single, robust script that will run inside the iframe
        const fullScript = `
          // Wait for the entire HTML document to be loaded and parsed
          document.addEventListener('DOMContentLoaded', () => {
            const rootElement = document.getElementById('root');
            
            try {
              // 1. The user's component, transpiled into a function
              const UserComponent = () => {
                ${transpiledJsx.replace(/export default/, 'return ')}
              };

              // 2. A new Wrapper component that handles interaction setup
              const InteractionWrapper = ({ children }) => {
                  const wrapperRef = React.useRef(null);

                  React.useEffect(() => {
                      // This code runs AFTER the component and its children have mounted
                      const rootNode = wrapperRef.current;
                      if (!rootNode) return;

                      let selectedElement = null;
                      let elementCounter = 0;

                      // Function to walk through all rendered elements and give them a unique ID
                      function assignDataIds(element) {
                          if (!element || typeof element.setAttribute !== 'function') return;
                          elementCounter++;
                          element.setAttribute('data-id', 'element-' + elementCounter);
                          for (const child of element.children) {
                              assignDataIds(child);
                          }
                      }
                      
                      // Start assigning IDs from the first child of the wrapper
                      if (rootNode.children.length > 0) {
                          assignDataIds(rootNode.children[0]);
                      }

                      // Add a click listener to the entire body of the iframe
                      document.body.addEventListener('click', (e) => {
                          e.preventDefault();
                          e.stopPropagation();

                          if (selectedElement) {
                              selectedElement.style.outline = '';
                          }
                          
                          selectedElement = e.target;
                          
                          const elementId = selectedElement.getAttribute('data-id');
                          if (elementId) {
                              selectedElement.style.outline = '2px solid #3b82f6';
                              // Send a message to the main app with the ID of the clicked element
                              window.parent.postMessage({ type: 'element-selected', elementId: elementId }, '*');
                          }
                      });

                  }, []); // Empty array ensures this runs only once on mount

                  return React.createElement('div', { ref: wrapperRef }, children);
              };

              // 3. Render the User's component *inside* our new InteractionWrapper
              ReactDOM.render(
                  React.createElement(InteractionWrapper, null, React.createElement(UserComponent)),
                  rootElement
              );

            } catch (e) {
              // If rendering fails, display a very clear error message inside the preview
              rootElement.innerHTML = '<div style="color: #ef4444; padding: 2rem; font-family: monospace;"><h3>Render Error</h3><pre>' + e.stack + '</pre></div>';
            }
          });
        `;

        // The complete HTML for the iframe
        const htmlContent = `
          <html>
            <head>
              <style>
                body { margin: 0; padding: 0; font-family: sans-serif; }
                ${code.css}
              </style>
              <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
              <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
            </head>
            <body>
              <div id="root"></div>
              <script type="text/javascript">${fullScript}</script>
            </body>
          </html>
        `;

        // Write the content to the iframe
        iframeDoc.open();
        iframeDoc.write(htmlContent);
        iframeDoc.close();
      }
    }
  }, [code]);

  return (
    <iframe
      ref={iframeRef}
      title="Component Preview"
      className="w-full h-full border-0 bg-white"
      sandbox="allow-scripts allow-same-origin"
    />
  );
}
