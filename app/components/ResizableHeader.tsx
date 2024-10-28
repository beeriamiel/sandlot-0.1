import React, { useState, useCallback, useRef, useEffect } from 'react';
import { TableHead } from "@/components/ui/table";

interface ResizableHeaderProps {
  children: React.ReactNode;
  onResize: (width: number) => void;
  width: number;
}

export function ResizableHeader({ children, onResize, width }: ResizableHeaderProps) {
  const [isResizing, setIsResizing] = useState(false);
  const headerRef = useRef<HTMLTableCellElement>(null);

  const startResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing && headerRef.current) {
      const newWidth = e.clientX - headerRef.current.getBoundingClientRect().left;
      onResize(newWidth);
    }
  }, [isResizing, onResize]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    }

    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  return (
    <TableHead ref={headerRef} style={{ width: `${width}px`, position: 'relative' }}>
      {children}
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          height: '100%',
          width: '5px',
          cursor: 'col-resize',
        }}
        onMouseDown={startResizing}
      />
    </TableHead>
  );
}
