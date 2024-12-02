# WaterlooWorks-Export-Lists

### To install dependencies:

```bash
bun install
```

### To run without auto-login:

```bash
bun run index.ts
```

### To run with auto-login:

Make a `.env` file in the working directory with:

```env
WAT_IM_USERNAME=[username]
WAT_IM_PASSWORD=[password]
```

and run

```bash
bun run index.ts
```

#### or

```bash
bun run index.ts --username [username] --password [password]
```

This project was created using `bun init` in bun v1.1.10. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
