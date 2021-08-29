# personium-webdav-proxy

Auth proxy for personium Cell WebDAV.

## How to use

By below command, you can launch this script.

```bash
deno run --allow-net https://raw.githubusercontent.com/yoh1496/personium-webdav-proxy/main/index.ts <CELL_URL> <CELL_USERNAME> <CELL_PASSWORD>
```

And then, configure your WebDAV application to open `localhost:8000/<BOX_NAME>` to access the Box in Personium Cell.

## How it works

![how_it_works](./img/how_it_works.drawio.svg)

WebDAV application usually does not contain an authentication method which passes `Bearer` token in Authorization header.

This software (script) proxies requests from WebDAV application to Box in Personium Cell with adding `Bearer` token in Authorization header.