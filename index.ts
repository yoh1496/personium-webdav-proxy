import { serve } from "https://deno.land/std@0.106.0/http/server.ts";
import {
  readerFromStreamReader,
  readableStreamFromReader,
} from "https://deno.land/std@0.106.0/io/mod.ts";

/** Listen port  */
const LISTEN_PORT = 8000;

/** Cell FQDN (ex. usercell001.pds.example.com) */
const PERSONIUM_CELL_FQDN = Deno.args[0];

/** Cell User (ex. accountName) */
const PERSONIUM_CELL_USER = Deno.args[1];

/** Cell Pass (ex. accountPass) */
const PERSONIUM_CELL_PASS = Deno.args[2];

async function authWithROPC(
  cellFQDN: string,
  username: string,
  password: string
) {
  const url = `https://${cellFQDN}/__token`;
  for (const i of [...Array(10)]) {
    console.log("get new token");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: new URLSearchParams({
          grant_type: "password",
          username: username,
          password: password,
        }).toString(),
      });
      const jsonDat = await res.json();
      const tokens = {
        access_token: jsonDat["access_token"],
        refresh_token: jsonDat["refresh_token"],
        expires_in: jsonDat["expires_in"],
      };
      return tokens;
    } catch (ex) {
      console.log("Exception thrown", ex);
      continue;
    }
  }
  throw "Auth Failed 10 times";
}

type PersoniumTokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

class AuthAdapter {
  cellFQDN: string;
  username: string;
  password: string;
  tokens: Promise<PersoniumTokens>;
  expires_in: number = 3600;
  last_auth_epoch: number = 0;

  constructor(cellFQDN: string, username: string, password: string) {
    this.cellFQDN = cellFQDN;
    this.username = username;
    this.password = password;
    this.last_auth_epoch = new Date().getTime();
    this.tokens = authWithROPC(this.cellFQDN, this.username, this.password);
  }

  async getToken() {
    if (
      (new Date().getTime() - this.last_auth_epoch) / 1000 >
      this.expires_in * 0.8
    ) {
      this.last_auth_epoch = new Date().getTime();
      this.tokens = authWithROPC(
        this.cellFQDN,
        this.username,
        this.password
      ).then((dat) => {
        this.expires_in = dat.expires_in;
        return dat;
      });
    }

    return this.tokens;
  }
}

const s = serve({ port: LISTEN_PORT });
console.log("http://localhost:8000/");

const config = {
  cellFQDN: PERSONIUM_CELL_FQDN,
  username: PERSONIUM_CELL_USER,
  password: PERSONIUM_CELL_PASS,
};

const adapter = new AuthAdapter(
  config.cellFQDN,
  config.username,
  config.password
);

for await (const req of s) {
  const tokens = await adapter.getToken();

  if (tokens == undefined) {
    throw "tokens is undefined";
  }

  const { access_token } = tokens;

  const nextUrl = new URL(`https://${config.cellFQDN}/`);
  nextUrl.pathname = req.url;

  const header = new Headers(req.headers);
  header.set("Authorization", `Bearer ${access_token}`);
  header.delete("host");

  const isBodyNeeded = !(req.method === "GET" || req.method === "HEAD");
  const bodyStreamReader = readableStreamFromReader(req.body);

  const res = await fetch(nextUrl, {
    method: req.method,
    headers: header,
    body: isBodyNeeded ? bodyStreamReader : null,
  });

  const bodyreader = res.body?.getReader();
  const reader = bodyreader ? readerFromStreamReader(bodyreader) : undefined;

  console.log(req.method, res.status, nextUrl.toString());

  req.respond({
    status: res.status,
    statusText: res.statusText,
    body: reader,
    headers: res.headers,
  });
}
