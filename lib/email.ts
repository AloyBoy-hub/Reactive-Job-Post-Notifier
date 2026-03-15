import { Resend } from "resend";

import { serverEnv } from "./serverEnv";

export interface DigestJob {
  jobTitle: string;
  companyName: string;
  salary: string | null;
  techStack: string[];
  requirementsSummary: string;
  jobUrl: string;
  sourceUrl: string;
  firstSeenAt: string;
}

let resendClient: Resend | null = null;

const getResendClient = (): Resend | null => {
  if (!serverEnv.resendApiKey) {
    return null;
  }
  if (resendClient) {
    return resendClient;
  }
  resendClient = new Resend(serverEnv.resendApiKey);
  return resendClient;
};

const escapeHtml = (value: string): string => {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const renderDigestHtml = (jobs: DigestJob[], trigger: "cron" | "manual"): string => {
  const rows = jobs
    .map((job) => {
      const techStack = job.techStack.length > 0 ? job.techStack.join(", ") : "Not specified";
      const salary = job.salary || "Not specified";
      return `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(job.companyName)}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(job.jobTitle)}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(salary)}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(techStack)}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(job.requirementsSummary.slice(0, 260))}</td>
          <td style="padding:12px;border-bottom:1px solid #e5e7eb;">
            <a href="${escapeHtml(job.jobUrl)}" target="_blank" rel="noreferrer">Open Listing</a>
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;color:#1f2937;">
      <h2 style="margin-bottom:10px;">Reactive Job Post Notifier Digest</h2>
      <p style="margin-top:0;">Trigger: ${escapeHtml(trigger)} | New jobs found: ${jobs.length}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <thead>
          <tr style="text-align:left;background:#f3f4f6;">
            <th style="padding:12px;">Company</th>
            <th style="padding:12px;">Role</th>
            <th style="padding:12px;">Salary</th>
            <th style="padding:12px;">Tech Stack</th>
            <th style="padding:12px;">Requirements Summary</th>
            <th style="padding:12px;">Listing</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
};

export const sendDigestEmail = async (jobs: DigestJob[], trigger: "cron" | "manual"): Promise<boolean> => {
  const client = getResendClient();
  if (!client || !serverEnv.resendFromEmail || !serverEnv.resendToEmail || jobs.length === 0) {
    return false;
  }

  await client.emails.send({
    from: serverEnv.resendFromEmail,
    to: [serverEnv.resendToEmail],
    subject: `Job digest: ${jobs.length} new role${jobs.length > 1 ? "s" : ""}`,
    html: renderDigestHtml(jobs, trigger)
  });

  return true;
};
