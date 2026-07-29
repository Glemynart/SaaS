import DOMPurify from 'isomorphic-dompurify';

const DOCUMENT_HTML_POLICY = {
  ALLOWED_TAGS: [
    'a',
    'b',
    'blockquote',
    'br',
    'div',
    'em',
    'h1',
    'h2',
    'h3',
    'hr',
    'i',
    'img',
    'li',
    'ol',
    'p',
    's',
    'span',
    'strong',
    'table',
    'tbody',
    'td',
    'tfoot',
    'th',
    'thead',
    'tr',
    'u',
    'ul',
  ],
  ALLOWED_ATTR: [
    'alt',
    'colspan',
    'data-document-variable',
    'height',
    'href',
    'rowspan',
    'src',
    'start',
    'title',
    'width',
  ],
  ALLOW_ARIA_ATTR: false,
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: [
    'button',
    'embed',
    'form',
    'iframe',
    'input',
    'math',
    'meta',
    'object',
    'script',
    'style',
    'svg',
  ],
  FORBID_ATTR: ['autofocus', 'class', 'contenteditable', 'id', 'srcdoc', 'style'],
  RETURN_TRUSTED_TYPE: false,
};

interface SafeDocumentHtmlProps {
  html: string;
  className?: string;
}

export function SafeDocumentHtml({ html, className }: SafeDocumentHtmlProps) {
  const sanitizedHtml = DOMPurify.sanitize(html, DOCUMENT_HTML_POLICY);

  return <div className={className} dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />;
}
