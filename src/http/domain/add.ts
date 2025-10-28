import { Request, Response } from "express";

export interface AddDomainRequest {
	name: string;
}

export interface AddDomainResponse {
	id: number;
	name: string;
}

// HTTP 方法: POST
export async function addDomainHandler(req: Request, res: Response) {
	if (req.method !== "POST") {
		return res.status(405).send("method not allowed");
	}
	const body = (req.body || {}) as Partial<AddDomainRequest>;
	const name = (body.name || "").trim();
	if (!name) return res.status(400).send("name is required");

	// 功能已移除：virtual_domains 表及逻辑体已删除
	return res.status(501).json({ error: "domain feature disabled" });
}


