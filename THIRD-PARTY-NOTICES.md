# Third-party notices

mint itself is licensed under the GNU General Public License, version 3 or later; see
[LICENSE](./LICENSE). This file covers the one third-party asset that ships inside mint.

## BIP-39 English word list (`src/wordlist.ts`)

The 2048-word list used by `mint passphrase` and `mint mnemonic` is the BIP-39 English word
list (<https://github.com/bitcoin/bips/blob/master/bip-0039/english.txt>), redistributed from
the `@scure/bip39` package (version 2.4.0). Only the word list is included: the checksum and
encoding logic in mint is its own implementation.

The `@scure/bip39` license follows.

---
The MIT License (MIT)

Copyright (c) 2022 Patricio Palladino, Paul Miller (paulmillr.com)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the â€œSoftwareâ€), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED â€œAS ISâ€, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

