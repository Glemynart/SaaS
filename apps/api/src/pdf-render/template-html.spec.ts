import { escapeHtml, replaceHtmlTemplateVariables } from './template-html';

describe('HTML template helpers', () => {
  it('escapes HTML text and attribute metacharacters', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('inserts values literally and escapes markup', () => {
    expect(
      replaceHtmlTemplateVariables('<p>{{VALUE}}</p>', {
        VALUE: '<img src=x onerror=1> $&',
      }),
    ).toBe('<p>&lt;img src=x onerror=1&gt; $&amp;</p>');
  });
});
