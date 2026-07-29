import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { SafeDocumentHtml } from './safe-document-html';

function renderDocumentHtml(html: string): string {
  return renderToStaticMarkup(createElement(SafeDocumentHtml, { html }));
}

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory()
      ? listSourceFiles(fullPath)
      : /\.(ts|tsx)$/.test(entry.name)
        ? [fullPath]
        : [];
  });
}

describe('SafeDocumentHtml', () => {
  it.each([
    ['script', '<script>alert(1)</script>'],
    ['iframe', '<iframe src="https://evil.example"></iframe>'],
    ['object', '<object data="https://evil.example"></object>'],
    ['embed', '<embed src="https://evil.example">'],
    ['form', '<form action="/steal"><input name="token"></form>'],
    ['svg', '<svg><g onload="alert(1)"></g></svg>'],
    ['mathml', '<math><mtext><img src=x onerror=alert(1)></mtext></math>'],
  ])('removes dangerous %s elements', (tag, payload) => {
    const rendered = renderDocumentHtml(`<p>Seguro</p>${payload}`);

    expect(rendered).toContain('<p>Seguro</p>');
    expect(rendered.toLowerCase()).not.toContain(`<${tag}`);
  });

  it('removes executable and document-loading attributes', () => {
    const rendered = renderDocumentHtml(
      '<img src="/uploads/logos/logo.png" onerror="alert(1)">' +
        '<p onclick="alert(1)">Texto</p>' +
        '<div srcdoc="<script>alert(1)</script>">Contenido</div>',
    );

    expect(rendered).not.toMatch(/\sonerror=/i);
    expect(rendered).not.toMatch(/\sonclick=/i);
    expect(rendered).not.toMatch(/\ssrcdoc=/i);
  });

  it('removes javascript URLs', () => {
    const rendered = renderDocumentHtml('<a href="javascript:alert(document.cookie)">Abrir</a>');

    expect(rendered).toContain('<a>Abrir</a>');
    expect(rendered).not.toMatch(/javascript:/i);
  });

  it('neutralizes a payload persisted in a template', () => {
    const storedTemplate = '<h2>Contrato</h2><img src=x onerror="fetch(\'/session\')">';

    const rendered = renderDocumentHtml(storedTemplate);

    expect(rendered).toContain('<h2>Contrato</h2>');
    expect(rendered).not.toContain('onerror');
  });

  it('neutralizes a payload persisted from employee data', () => {
    const contenidoFinal = '<p>Empleado: <img src=x onerror="alert(document.cookie)"></p>';

    const rendered = renderDocumentHtml(contenidoFinal);

    expect(rendered).toContain('<p>Empleado: <img src="x"></p>');
    expect(rendered).not.toContain('onerror');
  });

  it('protects historical content without mutating the original value', () => {
    const historicalContent = '<p>Documento histórico</p><script>window.compromised=true</script>';
    const originalContent = historicalContent;

    const rendered = renderDocumentHtml(historicalContent);

    expect(rendered).toContain('<p>Documento histórico</p>');
    expect(rendered).not.toContain('<script');
    expect(historicalContent).toBe(originalContent);
  });

  it('preserves allowed document formatting', () => {
    const rendered = renderDocumentHtml(
      '<h1>Título</h1><h2>Sección</h2><p><strong>Negrita</strong> ' +
        '<em>Cursiva</em> <u>Subrayado</u> <s>Tachado</s></p>' +
        '<blockquote>Cita</blockquote><hr>',
    );

    expect(rendered).toContain('<h1>Título</h1>');
    expect(rendered).toContain('<h2>Sección</h2>');
    expect(rendered).toContain('<strong>Negrita</strong>');
    expect(rendered).toContain('<em>Cursiva</em>');
    expect(rendered).toContain('<u>Subrayado</u>');
    expect(rendered).toContain('<s>Tachado</s>');
    expect(rendered).toContain('<blockquote>Cita</blockquote>');
    expect(rendered).toContain('<hr>');
  });

  it('preserves allowed images and strips unapproved attributes', () => {
    const rendered = renderDocumentHtml(
      '<img src="/uploads/logos/logo.png" alt="Logo" width="120" height="40" class="overlay" style="position:fixed">',
    );

    expect(rendered).toContain(
      '<img src="/uploads/logos/logo.png" alt="Logo" width="120" height="40">',
    );
    expect(rendered).not.toContain('class=');
    expect(rendered).not.toContain('style=');
  });

  it('preserves ordered and unordered lists', () => {
    const rendered = renderDocumentHtml('<ul><li>Uno</li></ul><ol start="2"><li>Dos</li></ol>');

    expect(rendered).toContain('<ul><li>Uno</li></ul>');
    expect(rendered).toContain('<ol start="2"><li>Dos</li></ol>');
  });

  it('preserves allowed tables', () => {
    const rendered = renderDocumentHtml(
      '<table><thead><tr><th colspan="2">Cargo</th></tr></thead>' +
        '<tbody><tr><td rowspan="1">Docente</td><td>Matemáticas</td></tr></tbody></table>',
    );

    expect(rendered).toContain('<table>');
    expect(rendered).toContain('<th colspan="2">Cargo</th>');
    expect(rendered).toContain('<td rowspan="1">Docente</td>');
  });

  it('preserves placeholders and their safe preview marker', () => {
    const rendered = renderDocumentHtml(
      '<p><span data-document-variable="true">{{NOMBRE_COMPLETO}}</span></p>',
    );

    expect(rendered).toContain('<span data-document-variable="true">{{NOMBRE_COMPLETO}}</span>');
  });

  it('does not change contenidoFinal at the render boundary', () => {
    const contenidoFinal = '<h2>Contrato</h2><p>Contenido canónico {{DOCUMENTO}}</p>';

    renderDocumentHtml(contenidoFinal);

    expect(contenidoFinal).toBe('<h2>Contrato</h2><p>Contenido canónico {{DOCUMENTO}}</p>');
  });

  it('prevents direct document HTML sinks outside the safe component', () => {
    const webSource = path.resolve(__dirname, '../..');
    const documentFeatureDirectories = [
      path.join(webSource, 'features/document-templates'),
      path.join(webSource, 'features/generated-documents'),
    ];

    const directSinks = documentFeatureDirectories
      .flatMap(listSourceFiles)
      .filter((file) => readFileSync(file, 'utf8').includes('dangerouslySetInnerHTML'));

    expect(directSinks).toEqual([]);
  });
});
