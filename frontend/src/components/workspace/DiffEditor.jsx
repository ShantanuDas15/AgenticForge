import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import useFlowStore from '@/store/useFlowStore';

/**
 * DiffEditor — A split-pane visual diff viewer for code iterations.
 * Leverages react-diff-viewer-continued to highlight precise word-level changes
 * between the Coder agent's current output and the previous iteration.
 */
function DiffEditor({ activeFilename, activeContent }) {
  const fileHistory = useFlowStore((state) => state.fileHistory);
  
  const history = fileHistory[activeFilename] || [];
  // Extract the immediate previous version. If there's only 1 version, oldCode is empty.
  const oldCode = history.length > 1 ? history[history.length - 2] : history[0] || '';
  const newCode = activeContent || '';

  // Theme overrides matching our AgenticForge dark aesthetic
  const customStyles = {
    variables: {
      dark: {
        diffViewerBackground: '#0d0d14',
        diffViewerColor: '#e4e4e7',
        addedBackground: '#044B53',
        addedColor: 'white',
        removedBackground: '#632F34',
        removedColor: 'white',
        wordAddedBackground: '#055d66',
        wordRemovedBackground: '#7d383f',
        addedGutterBackground: '#034148',
        removedGutterBackground: '#632b30',
        gutterBackground: '#0d0d14',
        gutterBackgroundDark: '#0d0d14',
        highlightBackground: '#2a3967',
        highlightGutterBackground: '#2d4077',
        codeFoldGutterBackground: '#0d0d14',
        codeFoldBackground: '#0d0d14',
        emptyLineBackground: '#0d0d14',
        gutterColor: '#8c8c8c',
        addedGutterColor: '#8c8c8c',
        removedGutterColor: '#8c8c8c',
        codeFoldContentColor: '#8c8c8c',
      }
    }
  };

  return (
    <div className="h-full w-full overflow-auto custom-scrollbar bg-[#0d0d14]">
      {history.length <= 1 ? (
        <div className="h-full flex flex-col items-center justify-center text-forge-muted-text space-y-2 opacity-50">
          <p className="text-sm font-semibold">First Iteration</p>
          <p className="text-xs italic">No previous versions available to compare against.</p>
        </div>
      ) : (
        <ReactDiffViewer
          oldValue={oldCode}
          newValue={newCode}
          splitView={true}
          compareMethod={DiffMethod.WORDS}
          useDarkTheme={true}
          styles={customStyles}
          leftTitle="Previous Iteration"
          rightTitle="Current Iteration"
        />
      )}
    </div>
  );
}

export default DiffEditor;
