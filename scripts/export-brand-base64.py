#!/usr/bin/env python3
"""Export brand PNGs as base64 TS modules for reliable PDF embedding on Vercel."""
import base64

PUB = "/home/z/my-project/public"
LIB = "/home/z/my-project/src/lib"

for name in ["shabab-logo", "shabab-signature"]:
    with open(f"{PUB}/{name}.png", "rb") as f:
        b64 = base64.b64encode(f.read()).decode()
    with open(f"{LIB}/{name.replace('-', '.')}.ts", "w") as f:
        f.write(
            "/** Auto-generated from public/%s.png — do not edit. */\n"
            "export const %s: string =\n" % (name, name.replace("-", "_").upper())
        )
        for i in range(0, len(b64), 100):
            f.write('  "%s" +\n' % b64[i : i + 100])
        f.write('  "";\n')
    print(f"wrote src/lib/{name.replace('-', '.')}.ts ({len(b64)//1024} KB base64)")
