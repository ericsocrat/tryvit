# Phase 5A.2 Checkpoint 1 typography assay

Status: proposal evidence only; no font is adopted, downloaded by the application, or
served by a review route.

Observed: 2026-08-17

## Method

Every candidate currently renders with the existing V2 system stacks. The browser
therefore makes zero font requests, transfers zero candidate font bytes, and incurs no
candidate font swap or font-caused layout shift.

The proposed pairings were assayed separately against this bounded EN/PL/DE character
corpus:

```text
ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ĄĆĘŁŃÓŚŹŻąćęłńóśźżÄÖÜẞäöüß.,:;!?…—–-()/+%· @#&
```

Corpus SHA-256:
`72f0518e7842217eef9dc2611e5c24872052563c0f82f9f557e4f5fb1923b079`.

The Google Fonts CSS2 API was requested with Chrome 151 content negotiation and the
exact `text` corpus above. Hashes apply to the returned WOFF2 payloads, not to an
unbounded family download. This is a transfer-cost assay, not an approved subset plan.

## Candidate proposals

| Candidate | Proposed relationship | Assayed files | Bounded bytes |
|---|---|---|---:|
| A — Source Fold | Manrope 400–800 for operational UI; Source Serif 4 600 for sparse editorial emphasis | Manrope variable: `d427698e2622efee3daa008c1873ac9608040493668f9f3f12688117f21f0e9f`, 18,264 bytes. Source Serif 4 600: `b9c2c0bff343d758f6ead13474edc177a8d6875349cdf0319c17583e13060aba`, 16,608 bytes. | 34,872 |
| B — Evidence Register | IBM Plex Sans width 75–100 / weight 400–700 for dense evidence; IBM Plex Mono 400/600 for source notation | IBM Plex Sans variable: `c94574a34ad5466510cd70e377e43f3b33290b4ff8cb8bf96eadd1c455298726`, 53,884 bytes. IBM Plex Mono 400: `38894aba8f3cfc0200035d2ff66cc5fe8788917568f8af19ab4bfa6a19b98ccd`, 10,768 bytes. IBM Plex Mono 600: `266a37dab03c70e0e5a396d89113291f10dd94c8c522cadfaeacae78a2207ffe`, 12,116 bytes. | 76,768 |
| C — Open Core | Atkinson Hyperlegible Next 400–800 for utility and small evidence; Newsreader 600 for high-level statements | Atkinson Hyperlegible Next variable: `78b88f38aab7acf47b422fd8e1af27912fe871c42c54864d345c965c4c4cef41`, 26,064 bytes. Newsreader 600: `d51fc87685c41c297ceeeda5b060a28451cffdaf738929c936f51516881485b1`, 17,380 bytes. | 43,444 |

All three bounded pairings remain below the Phase 5 font ceiling of 100 KiB, but that
does not establish a production budget. A real adoption assay must use the complete
approved message corpus, required styles, localized fallbacks, and any generated
metadata overhead.

## Exact upstream requests and payloads

- Manrope v20: [exact CSS request](https://fonts.googleapis.com/css2?family=Manrope:wght@400..800&display=swap&text=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789%C4%84%C4%86%C4%98%C5%81%C5%83%C3%93%C5%9A%C5%B9%C5%BB%C4%85%C4%87%C4%99%C5%82%C5%84%C3%B3%C5%9B%C5%BA%C5%BC%C3%84%C3%96%C3%9C%E1%BA%9E%C3%A4%C3%B6%C3%BC%C3%9F.%2C%3A%3B%21%3F%E2%80%A6%E2%80%94%E2%80%93-%28%29%2F%2B%25%C2%B7%20%40%23%26), [resolved WOFF2](https://fonts.gstatic.com/l/font?kit=xn7gYHE41ni1AdIRsgWjoN_8Xf2rQGYcfOPo95PJSPTzPoKH9jCsnU9bqUpYuMPmKxc6KfxA3U_VogePvmIXAMIdBSdTzK2OJHYOtXprnipNn0VP90SxlK-Y1BrRULy57khteqjM1I7MHu2jPVXI2Z17fkfoF1oGpWTjwSHIIdo0M4eBBiIij-bgNdo6Levo54x9Bg0DSFz8LglTi1YdlY74U_SVrYSPMASWBRNO4Pg815_2I5OEIEU83xPQMe4-8-BnkJCry4KfVk2_uYWfHybeb1z-ramB6afZD8m3TP207m8CrpP1xFj6vkuttXRSLNVBtueiPaC6zJkauzv_oh6Vpqd5QWhJQYm_V-yqGcSbguoSsZZ4QSbRJNhZpgAB0oHo4zJJpsQHdbRTIPIpxRLXGqlj0csN8G0uIKcDjuFpuOVvK0kMD3Hu9aWo4TEz6sECUsEVl6pbPyJS-f3er9I-eqioShAUM7fgD1tqxTIBJZsSSaApyJanEKWRicL4&skey=c397ded15edc0853&v=v20), [Google Fonts source and OFL](https://github.com/google/fonts/tree/main/ofl/manrope).
- Source Serif 4 v14: [exact CSS request](https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@600&display=swap&text=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789%C4%84%C4%86%C4%98%C5%81%C5%83%C3%93%C5%9A%C5%B9%C5%BB%C4%85%C4%87%C4%99%C5%82%C5%84%C3%B3%C5%9B%C5%BA%C5%BC%C3%84%C3%96%C3%9C%E1%BA%9E%C3%A4%C3%B6%C3%BC%C3%9F.%2C%3A%3B%21%3F%E2%80%A6%E2%80%94%E2%80%93-%28%29%2F%2B%25%C2%B7%20%40%23%26), [resolved WOFF2](https://fonts.gstatic.com/l/font?kit=vEFy2_tTDB4M7-auWDN0ahZJW3IX2ih5nk3AucvUHf6OAVIJmeUDygwjisltrhlP5OYnhxf5eFgb2OAIb5ff_g75ecGeSfI9yfMVm_9zrm9Zg4Dq3AkNViwPPgLJgrXKJV7oPH99gWQ5pHmEycbZBIUPbTtQhIft9OcsIH6G7r_7B8WwU2oXzsLcV3fy0SoZI0g7VvBA9YHGKcI7oYFnBtO8Nr3UeVyPm0Tv7md1CelllTm7wK_bVHnW1jQyZMZhvvjk3ntIzDTJSZ5RgTirhKAyI3bVB7BG2EIZZ7xZ2sn_4bEzNwg2OtH6RlRz0YhCVyr3kHDMJlJR-tJ3dlBM5iZ7s4yGD3N-RruVV1qOw-YgCnq6Kd0bg3t3BxzvfR37MdiySu_Lx0-77w3zXR1ubcrGeHD5co1uGjdoohXCSE2dTXyq0A2v0W_vu0gGS0zEcbFYjX3NHrqo08yMTnmnWfhul_amIHP4uG_2Rzs93l6rR-r7hBq7xiQweI4R8f6KGJPi5DfK9Kg1EFxV1o8iV30mclkDbUcygJX9mVKgWFhI&skey=8bcb392be1d494a6&v=v14), [Google Fonts source and OFL](https://github.com/google/fonts/tree/main/ofl/sourceserif4).
- IBM Plex Sans v23: [exact CSS request](https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wdth,wght@75..100,400..700&display=swap&text=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789%C4%84%C4%86%C4%98%C5%81%C5%83%C3%93%C5%9A%C5%B9%C5%BB%C4%85%C4%87%C4%99%C5%82%C5%84%C3%B3%C5%9B%C5%BA%C5%BC%C3%84%C3%96%C3%9C%E1%BA%9E%C3%A4%C3%B6%C3%BC%C3%9F.%2C%3A%3B%21%3F%E2%80%A6%E2%80%94%E2%80%93-%28%29%2F%2B%25%C2%B7%20%40%23%26), [resolved WOFF2](https://fonts.gstatic.com/l/font?kit=zYXgKVElMYYaJe8bpLHnCwDKtdPM_4RsUPTOKENU2hB0J6zINLxSSOG1FSJqOrMC3sbsqKSaUxLVp-RF9Ca3tSm9qdyiRBpA7JQjpaxJJzf51AabbDdIoZrZ_hSxB9n6uDZkBOUsutml89yXr9ZGl27fmLfnr99SCVh9NdSD32JgZxvw4xKpA2Fj9nzLt9sY8pMrMPogLkSTkWyemRpzrWYGwd7bIzbDZBqB-BbyvfpLTbu_ir7mjxx3o961kxxmUuZSWCJ-kVLAUWwzn-ENVw9RJF3XlZyKkaoWMjRYDe-3WAh-a2Cdu66yunE1nTtq5GQchyNAiF6VLfMJZkrTv4uy0zvLXMDMfw7HmyhmJdeF0SOszTzE_QdY66ugk02RngQCGQQ1LsIZZ66QU4F605_dpTWq-rijcGDsq5RRJaVamF4Kn9iZfSxo4VdNXij18vUNUoZuO7Bud8nivhbLwSYqnblJT7kU6gIO5b5i18LbMUEvCPW0OqlW6GG67id1mcEz_jxy&skey=db4d85f0f9937532&v=v23), [Google Fonts source and OFL](https://github.com/google/fonts/tree/main/ofl/ibmplexsans).
- IBM Plex Mono v20: [exact CSS request](https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&display=swap&text=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789%C4%84%C4%86%C4%98%C5%81%C5%83%C3%93%C5%9A%C5%B9%C5%BB%C4%85%C4%87%C4%99%C5%82%C5%84%C3%B3%C5%9B%C5%BA%C5%BC%C3%84%C3%96%C3%9C%E1%BA%9E%C3%A4%C3%B6%C3%BC%C3%9F.%2C%3A%3B%21%3F%E2%80%A6%E2%80%94%E2%80%93-%28%29%2F%2B%25%C2%B7%20%40%23%26), [Google Fonts source and OFL](https://github.com/google/fonts/tree/main/ofl/ibmplexmono). The request resolves one WOFF2 for each recorded weight; both hashes are listed above.
- Atkinson Hyperlegible Next v7: [exact CSS request](https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400..800&display=swap&text=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789%C4%84%C4%86%C4%98%C5%81%C5%83%C3%93%C5%9A%C5%B9%C5%BB%C4%85%C4%87%C4%99%C5%82%C5%84%C3%B3%C5%9B%C5%BA%C5%BC%C3%84%C3%96%C3%9C%E1%BA%9E%C3%A4%C3%B6%C3%BC%C3%9F.%2C%3A%3B%21%3F%E2%80%A6%E2%80%94%E2%80%93-%28%29%2F%2B%25%C2%B7%20%40%23%26), [resolved WOFF2](https://fonts.gstatic.com/l/font?kit=NaPNcYPdHfdVxJw0IfIP0lvYFqijb-UxCtm5_wdGsdiLjZCchG9cVkOfDdwtmd1W5QwlI697bxYgTyl--v6ne80Q9MYGYuzeyH3C11US0Ouvz96Ho8_RLCoBppeQqqprbBn0O6GUDgmQzCHFL65nkmhW9-DG3S-NhZbB1kM6JdPS3UAq7wpRyfvS6ioqzm2F95zcTCWr0U6rpnLheNcTy3gC20uAVa08kSBrfdvs5S7dWyJ7SER3tzpjpRBANu_s9HfHTiUjOLoex3w7wTwSgcbDgqj57gvefQTLqoc1AzY5q1nfpkHj2U99hte3z5SrHlF-ukHHPAhTHzg7r2iAYdGWFS5V9PpWGtIDujVq8BAfQqXs3YQpU_tujGhMHNsNsNc8eEfFdLjo1aDmwsVtgBcjB52d-0MsZmuPvUtwJEyedVgfznvS6iasRAw9tDUhmaiZq9txFcgwDnFUmZIp547s-E5_A3_fTN-eVyCJFrhCfRGdI9kbe_VzIJUEojmLSC7meThF0ukYD3BLgdaSjBWq8w&skey=cc6f4df37b6931db&v=v7), [Google Fonts source and OFL](https://github.com/google/fonts/tree/main/ofl/atkinsonhyperlegiblenext).
- Newsreader v26: [exact CSS request](https://fonts.googleapis.com/css2?family=Newsreader:wght@600&display=swap&text=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789%C4%84%C4%86%C4%98%C5%81%C5%83%C3%93%C5%9A%C5%B9%C5%BB%C4%85%C4%87%C4%99%C5%82%C5%84%C3%B3%C5%9B%C5%BA%C5%BC%C3%84%C3%96%C3%9C%E1%BA%9E%C3%A4%C3%B6%C3%BC%C3%9F.%2C%3A%3B%21%3F%E2%80%A6%E2%80%94%E2%80%93-%28%29%2F%2B%25%C2%B7%20%40%23%26), [resolved WOFF2](https://fonts.gstatic.com/l/font?kit=cY9qfjOCX1hbuyalUrK49dLac06G1ZGsZBtoBCzBDXXD9JVF438wpojACfSvNBGZon2F9Q5tH8kFGoEDBvNzzINS77-ykvMA8QRZwEVhIktaBq9RyxrVzhF6FhZy_D0kjoVt2ifsjOyAGw86YPW9jw6xpZ6lNuZxc2wt9sPepi2YYgebkBRRzVmGyB-ihzATByKjbRtB5zaiatZtgqthEDXdhJBTm0EA3yZ_sEB479mYJN8ec4eHq9SvY779ZCos_RDfCXNPfYSS_kERGPnZUg6n8rwJ98OpFE0SWNkYRDr8gMR_YVHZ3EsQ3R9QGx4zvuBooc9LjMBqgBAMHZorUf-K20r8vwI4XirDEZ7zzc0QKgviQuPSFF4VRPe-81IqccZApapOw26E2JBLNxFzq-xo9UDvNBII1px3XTA3JbPr25gw24UknIRlJ9gpVy-EMJ0byFmGqrsQuJhDKy3L7DQSuGhH6u7GIBL51j3g8QHxnTJZSCTsr2JLqah6fpWSI4sJFol0PXTRf80RxrCvxahlNeH3vZujVmoa9Ow&skey=e69ba3232be0ce27&v=v26), [Google Fonts source and OFL](https://github.com/google/fonts/tree/main/ofl/newsreader).

## Adoption gate

Selection does not authorize production use. If Eric selects a pairing, a separate
adoption step must:

1. self-host exact approved files rather than introducing runtime Google requests;
2. expand the corpus to every approved EN/PL/DE message and required symbol;
3. record family/version, Reserved Font Names, OFL text, upstream commit, bytes, and
   SHA-256 for each vendored file;
4. measure fallback metrics and add `size-adjust`, ascent, descent, and line-gap
   overrides only from measured values;
5. prove no material CLS and stay within the 100 KiB total font budget; and
6. repeat security, license, localization, performance, and visual review.
