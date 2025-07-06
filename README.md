# VisionLora

This repository contains a Node.js port of the [MyLora](https://github.com/AsaTyr2018/MyLora) project.  The original project used FastAPI with Uvicorn.  This version uses Express and Nunjucks while keeping the same template and static resources.

## Quick start

Install dependencies and start the server:

```bash
npm install
npm start
```

The application listens on `http://localhost:5000`.

> **Note**: The repository omits the `404.jpg` and `accessdenied.jpg` placeholders from `loradb/static`. Add your own copies if you want custom error images.

## Initial admin account

Create the first administrator account using the provided script:

```bash
node usersetup.js <username> <password>
```
