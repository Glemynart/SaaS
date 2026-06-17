export function baseLayout(params: {
  title: string;
  preheader: string;
  body: string;
  fromName: string;
}): string {
  const { title, preheader, body, fromName } = params;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .wrapper { width: 100%; background-color: #f4f4f5; padding: 32px 16px; box-sizing: border-box; }
    .card { max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .header { background-color: #1e293b; padding: 24px 32px; }
    .header-name { color: #ffffff; font-size: 18px; font-weight: 600; margin: 0; }
    .body { padding: 32px; color: #374151; font-size: 15px; line-height: 1.6; }
    .footer { padding: 20px 32px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px; }
    .btn { display: inline-block; background-color: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 600; font-size: 15px; margin: 20px 0; }
    .link-fallback { word-break: break-all; color: #2563eb; font-size: 13px; }
    p { margin: 0 0 16px; }
  </style>
</head>
<body>
  <span style="display:none;max-height:0;overflow:hidden;">${preheader}</span>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <p class="header-name">${fromName}</p>
      </div>
      <div class="body">
        ${body}
      </div>
      <div class="footer">
        Este correo fue enviado por ${fromName}. Si no solicitaste esta acción, puedes ignorarlo.
      </div>
    </div>
  </div>
</body>
</html>`;
}
