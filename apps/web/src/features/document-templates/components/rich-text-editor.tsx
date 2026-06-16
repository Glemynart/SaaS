'use client';

import { useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Undo2,
  Redo2,
  Variable,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AVAILABLE_VARIABLES } from '@/features/document-templates/schemas/document-template-schemas';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded text-xs transition-colors',
        active
          ? 'bg-accent text-white'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
        disabled && 'opacity-30',
      )}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = 'Escribí el contenido del documento...',
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none focus:outline-none min-h-[16rem] px-5 py-4 text-sm leading-relaxed text-foreground',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    immediatelyRender: false,
  });

  const insertVariable = useCallback(
    (key: string) => {
      if (!editor) return;
      editor.chain().focus().insertContent(`{{${key}}}`).run();
    },
    [editor],
  );

  if (!editor) {
    return (
      <div className="flex min-h-[16rem] items-center justify-center rounded-lg border border-border bg-muted/30">
        <p className="text-xs text-muted-foreground">Cargando editor...</p>
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border bg-white', className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-surface/50 px-2 py-1.5">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Negrita"
        >
          <Bold className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Cursiva"
        >
          <Italic className="size-3.5" />
        </ToolbarButton>

        <span className="mx-1 h-4 w-px bg-border" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
          title="Título 1"
        >
          <Heading1 className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Título 2"
        >
          <Heading2 className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="Título 3"
        >
          <Heading3 className="size-3.5" />
        </ToolbarButton>

        <span className="mx-1 h-4 w-px bg-border" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Lista"
        >
          <List className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Lista numerada"
        >
          <ListOrdered className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Cita"
        >
          <Quote className="size-3.5" />
        </ToolbarButton>

        <span className="mx-1 h-4 w-px bg-border" />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Deshacer"
        >
          <Undo2 className="size-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Rehacer"
        >
          <Redo2 className="size-3.5" />
        </ToolbarButton>

        <span className="mx-1 h-4 w-px bg-border" />

        <div className="relative flex items-center">
          <select
            title="Insertar variable"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) {
                insertVariable(e.target.value);
                e.target.value = '';
              }
            }}
            className="h-7 cursor-pointer appearance-none rounded border border-border bg-white px-2 pr-6 text-[0.68rem] text-muted-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="" disabled>
              <Variable className="size-3 inline" /> + Variable
            </option>
            {AVAILABLE_VARIABLES.map((v) => (
              <option key={v.key} value={v.key}>
                {`{{${v.key}}}`} — {v.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
