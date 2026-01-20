import { RepertoireNode, Color } from '../types';

interface RepertoireTreeProps {
  node: RepertoireNode;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  color: Color;
  depth?: number;
}

export function RepertoireTree({
  node,
  selectedNodeId,
  onSelectNode,
  color,
  depth = 0
}: RepertoireTreeProps) {
  if (!node) return null;

  const isSelected = node.id === selectedNodeId;
  const isOpponentNode = node.colorToMove !== color;

  return (
    <div style={{ marginLeft: depth > 0 ? '20px' : '0' }}>
      <div
        onClick={() => onSelectNode(node.id)}
        style={{
          padding: '4px 8px',
          margin: '2px 0',
          backgroundColor: isSelected
            ? '#3b82f6'
            : isOpponentNode
            ? '#fee2e2'
            : '#dcfce7',
          color: isSelected ? '#ffffff' : 'inherit',
          borderRadius: '4px',
          cursor: 'pointer',
          fontWeight: node.move ? 'bold' : 'normal',
          border: '1px solid #ccc',
          fontSize: '14px'
        }}
      >
        {node.moveNumber}.{node.move && (
          <span>
            {node.colorToMove === 'w' ? '' : '... '}
            {node.move}
          </span>
        )}
      </div>
      {node.children.length > 0 && (
        <div style={{ borderLeft: '1px solid #ccc', paddingLeft: '8px' }}>
          {node.children.map((child: RepertoireNode) => (
            <RepertoireTree
              key={child.id}
              node={child}
              selectedNodeId={selectedNodeId}
              onSelectNode={onSelectNode}
              color={color}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface RepertoireTreeViewProps {
  repertoire: RepertoireNode;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  color: Color;
}

export function RepertoireTreeView({
  repertoire,
  selectedNodeId,
  onSelectNode,
  color
}: RepertoireTreeViewProps) {
  return (
    <div style={{ padding: '16px', overflow: 'auto', maxHeight: '500px' }}>
      <RepertoireTree
        node={repertoire}
        selectedNodeId={selectedNodeId}
        onSelectNode={onSelectNode}
        color={color}
      />
    </div>
  );
}
