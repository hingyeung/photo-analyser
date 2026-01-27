import type { Application, Request, Response } from "express";
import path from "node:path";
import fs from "node:fs";
import { getDb } from "../db/connection.js";
import { config } from "../config.js";
import type { ImageRecord, AnalysisResult } from "../types.js";

const PAGE_SIZE = 24;

export function setupRoutes(app: Application): void {
  // Gallery page
  app.get("/", (req: Request, res: Response) => {
    const db = getDb();
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const sort = (req.query.sort as string) || "created_at";
    const order = (req.query.order as string) === "asc" ? "ASC" : "DESC";

    const allowedSorts = [
      "created_at",
      "filename",
      "overall_impact",
      "processed",
    ];
    const sortCol = allowedSorts.includes(sort) ? sort : "created_at";

    // For overall_impact sort, we need to extract from JSON
    let orderClause: string;
    if (sortCol === "overall_impact") {
      orderClause = `json_extract(analysis_result, '$.overall_impact') ${order} NULLS LAST`;
    } else {
      orderClause = `${sortCol} ${order}`;
    }

    const totalCount = (
      db.prepare("SELECT COUNT(*) as count FROM images").get() as {
        count: number;
      }
    ).count;
    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const offset = (page - 1) * PAGE_SIZE;

    const images = db
      .prepare(
        `SELECT * FROM images ORDER BY ${orderClause} LIMIT ? OFFSET ?`
      )
      .all(PAGE_SIZE, offset) as ImageRecord[];

    const imagesWithAnalysis = images.map((img) => ({
      ...img,
      analysis: img.analysis_result
        ? (JSON.parse(img.analysis_result) as AnalysisResult)
        : null,
    }));

    res.render("gallery", {
      images: imagesWithAnalysis,
      page,
      totalPages,
      totalCount,
      sort: sortCol,
      order: order.toLowerCase(),
    });
  });

  // Detail page
  app.get("/image/:id", (req: Request, res: Response) => {
    const db = getDb();
    const image = db
      .prepare("SELECT * FROM images WHERE id = ?")
      .get(req.params.id) as ImageRecord | undefined;

    if (!image) {
      res.status(404).send("Image not found");
      return;
    }

    const analysis = image.analysis_result
      ? (JSON.parse(image.analysis_result) as AnalysisResult)
      : null;

    // Get prev/next for navigation
    const prev = db
      .prepare("SELECT id FROM images WHERE id < ? ORDER BY id DESC LIMIT 1")
      .get(image.id) as { id: number } | undefined;
    const next = db
      .prepare("SELECT id FROM images WHERE id > ? ORDER BY id ASC LIMIT 1")
      .get(image.id) as { id: number } | undefined;

    res.render("detail", { image, analysis, prevId: prev?.id, nextId: next?.id });
  });

  // Serve original images from IMAGE_DIR
  app.get("/photos/*", (req: Request, res: Response) => {
    const requestedPath = req.params[0];
    const fullPath = path.resolve(config.IMAGE_DIR, requestedPath);

    // Prevent directory traversal
    if (!fullPath.startsWith(config.IMAGE_DIR)) {
      res.status(403).send("Forbidden");
      return;
    }

    if (!fs.existsSync(fullPath)) {
      res.status(404).send("Not found");
      return;
    }

    res.sendFile(fullPath);
  });

  // JSON API
  app.get("/api/images", (req: Request, res: Response) => {
    const db = getDb();
    const images = db
      .prepare("SELECT * FROM images ORDER BY created_at DESC")
      .all() as ImageRecord[];

    const result = images.map((img) => ({
      ...img,
      analysis_result: img.analysis_result
        ? JSON.parse(img.analysis_result)
        : null,
    }));

    res.json(result);
  });
}
