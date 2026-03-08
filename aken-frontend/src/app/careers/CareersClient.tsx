"use client";

import { useId, useMemo, useRef, useState } from "react";

type PositionOption =
  | "Structural Engineer"
  | "Site Supervisor"
  | "Safety Officer (HSE)"
  | "Certified Welder/Fitter"
  | "Office Administration"
  | "Other";

const POSITIONS: PositionOption[] = [
  "Structural Engineer",
  "Site Supervisor",
  "Safety Officer (HSE)",
  "Certified Welder/Fitter",
  "Office Administration",
  "Other",
];

const MAX_FILE_BYTES = 5 * 1024 * 1024;

function bytesToHuman(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)}MB`;
}

function getFileExtension(name: string) {
  const idx = name.lastIndexOf(".");
  if (idx === -1) return "";
  return name.slice(idx + 1).toLowerCase();
}

function validateResumeFile(file: File | null): string | null {
  if (!file) return "Please upload your bio-data (resume).";

  const ext = getFileExtension(file.name);
  const allowed = new Set(["pdf", "doc", "docx"]);

  if (!allowed.has(ext)) {
    return "Invalid file format. Please upload a PDF or Word Document.";
  }

  if (file.size > MAX_FILE_BYTES) {
    return `File is too large. Maximum size is ${bytesToHuman(MAX_FILE_BYTES)}.`;
  }

  return null;
}

function clampDigitsOnly10(value: string) {
  const digitsOnly = value.replace(/\D/g, "");
  return digitsOnly.slice(0, 10);
}

export default function CareersClient() {
  const formId = useId();

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const [fileError, setFileError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const resumeMeta = useMemo(() => {
    if (!resumeFile) return null;
    return { name: resumeFile.name, size: resumeFile.size };
  }, [resumeFile]);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function setFileWithValidation(file: File | null) {
    const err = validateResumeFile(file);
    setResumeFile(file);
    setFileError(err);
    setSubmitSuccess(null);
    setSubmitError(null);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setFileWithValidation(file);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0] ?? null;
    // Keep input in sync so browser form UX remains consistent.
    if (fileInputRef.current) {
      const dt = new DataTransfer();
      if (file) dt.items.add(file);
      fileInputRef.current.files = dt.files;
    }
    setFileWithValidation(file);
  }

  function preventDefaults(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
  }

  function clearFile() {
    setResumeFile(null);
    setFileError("Please upload your bio-data (resume).");
    setSubmitSuccess(null);
    setSubmitError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setSubmitError(null);
    setSubmitSuccess(null);

    const form = e.currentTarget;
    const formData = new FormData(form);

    // Mobile: restricted to 10 digits via JS regex
    const mobile = String(formData.get("mobile") ?? "");
    const mobileDigits = mobile.replace(/\D/g, "");
    if (!/^\d{10}$/.test(mobileDigits)) {
      setSubmitError("Please enter a valid 10-digit mobile number.");
      return;
    }

    // File: must be correct ext and size
    const file = (formData.get("resume") as File | null) ?? null;
    const fileValidation = validateResumeFile(file);
    if (fileValidation) {
      setFileError(fileValidation);
      setSubmitError("Please fix the highlighted errors and try again.");
      return;
    }

    // HTML5 constraint validation for required fields / email, etc.
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    // Production note: hook this up to an API endpoint with CSRF & malware scanning.
    setSubmitSuccess(
      "Thank you for your application. Our HR team will review your bio-data and contact you shortly.",
    );

    // Optional UX: reset (keep success visible)
    form.reset();
    if (fileInputRef.current) fileInputRef.current.value = "";
    setResumeFile(null);
    setFileError(null);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-[url('/hero-steel.jpg')] bg-cover bg-center"
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/75 to-slate-950"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-6xl px-6 py-20 sm:py-24">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-700/60 bg-slate-950/40 px-3 py-1 text-xs tracking-wide text-slate-200">
              <span className="h-2 w-2 rounded-full bg-orange-500" />
              Careers & Talent Portal
            </div>

            <h1 className="mt-6 text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Build the Future of Industrial Infrastructure.
            </h1>

            <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-slate-200 sm:text-lg">
              {
                "Join the team at A K ENGINEERING. We are looking for driven engineers, safety officers, and master fabricators to help us execute Eastern India's most complex structural projects."
              }
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#apply"
                className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-sm shadow-orange-500/20 ring-1 ring-orange-400/30 transition hover:bg-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
              >
                Apply Now
              </a>
              <a
                href="#values"
                className="inline-flex items-center justify-center rounded-lg border border-slate-700/70 bg-slate-950/30 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-900/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                Why Join Us
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* VALUES */}
      <section id="values" className="bg-slate-950">
        <div className="mx-auto max-w-6xl px-6 py-14 sm:py-16">
          <div className="flex items-end justify-between gap-6">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Why Join Us
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-300 sm:text-base">
                A heavy-duty culture built on safety, scale, and constant
                upskilling—delivered with corporate discipline.
              </p>
            </div>
            <div className="hidden rounded-full border border-slate-800 bg-slate-950/40 px-4 py-2 text-xs text-slate-300 sm:block">
              Engineering Blue • Construction Orange • Steel Grey
            </div>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {/* Card 1 */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-600/15 ring-1 ring-blue-500/25">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-6 w-6 text-blue-400"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 2l7 4v6c0 5-3 9-7 10-4-1-7-5-7-10V6l7-4Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M9.5 12l1.8 1.8L15 10"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-white">
                  Safety First Culture
                </h3>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-slate-300">
                Commitment to Zero-Harm environments through training, PPE
                discipline, permits, and field supervision.
              </p>
            </div>

            {/* Card 2 */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-orange-500/15 ring-1 ring-orange-400/25">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-6 w-6 text-orange-300"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 20V9l8-5 8 5v11"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M9 20v-7h6v7"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-white">
                  Scale & Ambition
                </h3>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-slate-300">
                Work on massive multi-crore EPC projects—structures, sheds,
                conveyors, and industrial infrastructure at speed.
              </p>
            </div>

            {/* Card 3 */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-200/10 ring-1 ring-slate-200/15">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-6 w-6 text-slate-200"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 3v18"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                    <path
                      d="M7 8l5-5 5 5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M7 16l5 5 5-5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3 className="text-base font-semibold text-white">
                  Continuous Growth
                </h3>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-slate-300">
                Skill development at our state-of-the-art Hirakud facility—with
                mentors, process, and measurable progress.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* APPLICATION PORTAL */}
      <section id="apply" className="bg-slate-100 text-slate-900">
        <div className="mx-auto max-w-6xl px-6 py-14 sm:py-16">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-xl">
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                The Job Application Portal
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-700 sm:text-base">
                Submit your details and upload your bio-data. We validate file
                type and size before submission.
              </p>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
                <div className="text-sm font-semibold text-slate-900">
                  Upload Requirements
                </div>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  <li>
                    Accepted formats: <span className="font-medium">.pdf</span>,{" "}
                    <span className="font-medium">.doc</span>,{" "}
                    <span className="font-medium">.docx</span>
                  </li>
                  <li>
                    Max size: <span className="font-medium">5MB</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="w-full lg:max-w-3xl">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 sm:text-xl">
                      Submit Your Bio-Data
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Fields marked <span className="text-orange-600">*</span>{" "}
                      are required.
                    </p>
                  </div>
                  <div className="hidden sm:block">
                    <span className="rounded-full bg-blue-600/10 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-600/15">
                      Secure Intake
                    </span>
                  </div>
                </div>

                <form
                  id={formId}
                  className="mt-6 space-y-6"
                  onSubmit={handleSubmit}
                  noValidate={false}
                >
                  {/* Row 1 */}
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor={`${formId}-fullName`}
                        className="block text-sm font-semibold text-slate-800"
                      >
                        Full Name <span className="text-orange-600">*</span>
                      </label>
                      <input
                        id={`${formId}-fullName`}
                        name="fullName"
                        type="text"
                        required
                        autoComplete="name"
                        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                        placeholder="e.g., Ankit Kumar"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor={`${formId}-email`}
                        className="block text-sm font-semibold text-slate-800"
                      >
                        Email Address <span className="text-orange-600">*</span>
                      </label>
                      <input
                        id={`${formId}-email`}
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                        placeholder="name@example.com"
                      />
                    </div>
                  </div>

                  {/* Row 2 */}
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor={`${formId}-mobile`}
                        className="block text-sm font-semibold text-slate-800"
                      >
                        Mobile Number <span className="text-orange-600">*</span>
                      </label>
                      <input
                        id={`${formId}-mobile`}
                        name="mobile"
                        type="tel"
                        required
                        inputMode="numeric"
                        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                        placeholder="10-digit number"
                        onChange={(e) => {
                          e.currentTarget.value = clampDigitsOnly10(
                            e.currentTarget.value,
                          );
                          setSubmitError(null);
                        }}
                        aria-describedby={`${formId}-mobileHelp`}
                      />
                      <div
                        id={`${formId}-mobileHelp`}
                        className="mt-2 text-xs text-slate-600"
                      >
                        Digits only (10). We do not accept country codes here.
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor={`${formId}-position`}
                        className="block text-sm font-semibold text-slate-800"
                      >
                        Position Applied For{" "}
                        <span className="text-orange-600">*</span>
                      </label>
                      <select
                        id={`${formId}-position`}
                        name="position"
                        required
                        defaultValue=""
                        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                      >
                        <option value="" disabled>
                          Select a position
                        </option>
                        {POSITIONS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 3 */}
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor={`${formId}-experience`}
                        className="block text-sm font-semibold text-slate-800"
                      >
                        Total Years of Experience{" "}
                        <span className="text-orange-600">*</span>
                      </label>
                      <input
                        id={`${formId}-experience`}
                        name="experienceYears"
                        type="number"
                        required
                        min={0}
                        step={0.5}
                        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                        placeholder="e.g., 3"
                      />
                    </div>

                    <div className="sm:pt-7">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
                        Tip: Mention project scale, safety exposure, and
                        certifications in your intro.
                      </div>
                    </div>
                  </div>

                  {/* Cover letter */}
                  <div>
                    <label
                      htmlFor={`${formId}-cover`}
                      className="block text-sm font-semibold text-slate-800"
                    >
                      Cover Letter / Brief Intro{" "}
                      <span className="text-orange-600">*</span>
                    </label>
                    <textarea
                      id={`${formId}-cover`}
                      name="coverLetter"
                      required
                      rows={5}
                      className="mt-2 w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                      placeholder="Tell us about your experience, key projects, and the role you’re applying for."
                    />
                  </div>

                  {/* Resume Upload */}
                  <div>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-slate-800">
                          Upload Your Bio-Data / Resume{" "}
                          <span className="text-orange-600">*</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          Accepted formats: .pdf, .doc, .docx (Max 5MB)
                        </div>
                      </div>

                      {resumeMeta ? (
                        <button
                          type="button"
                          onClick={clearFile}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/25"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>

                    <div
                      className={[
                        "mt-3 rounded-2xl border-2 border-dashed p-5 transition",
                        isDragging
                          ? "border-blue-600 bg-blue-50"
                          : "border-slate-300 bg-slate-50",
                      ].join(" ")}
                      onDragEnter={(e) => {
                        preventDefaults(e);
                        setIsDragging(true);
                      }}
                      onDragOver={(e) => {
                        preventDefaults(e);
                        setIsDragging(true);
                      }}
                      onDragLeave={(e) => {
                        preventDefaults(e);
                        setIsDragging(false);
                      }}
                      onDrop={handleDrop}
                      role="button"
                      tabIndex={0}
                      onClick={openFilePicker}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") openFilePicker();
                      }}
                      aria-describedby={`${formId}-resumeHelp ${formId}-resumeError`}
                    >
                      <div className="flex flex-col items-center justify-center gap-2 text-center">
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          className="h-7 w-7 text-slate-500"
                          aria-hidden="true"
                        >
                          <path
                            d="M12 16V4"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                          <path
                            d="M7 9l5-5 5 5"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinejoin="round"
                          />
                          <path
                            d="M4 20h16"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>

                        {resumeMeta ? (
                          <>
                            <div className="text-sm font-semibold text-slate-900">
                              {resumeMeta.name}
                            </div>
                            <div className="text-xs text-slate-600">
                              {(resumeMeta.size / 1024).toFixed(0)} KB
                            </div>
                            <div className="text-xs text-slate-600">
                              Click to change, or drag & drop another file.
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-sm font-semibold text-slate-900">
                              Drag & drop your file here
                            </div>
                            <div className="text-xs text-slate-600">
                              or click to browse
                            </div>
                          </>
                        )}

                        <input
                          ref={fileInputRef}
                          name="resume"
                          type="file"
                          accept=".pdf, .doc, .docx"
                          className="sr-only"
                          onChange={handleFileInputChange}
                        />
                      </div>
                    </div>

                    <div id={`${formId}-resumeHelp`} className="mt-2 text-xs">
                      <span className="text-slate-600">
                        We recommend a PDF export for best formatting.
                      </span>
                    </div>

                    {fileError ? (
                      <div
                        id={`${formId}-resumeError`}
                        className="mt-2 text-sm font-medium text-red-600"
                      >
                        {fileError}
                      </div>
                    ) : (
                      <div id={`${formId}-resumeError`} className="sr-only" />
                    )}
                  </div>

                  {/* Submission UX */}
                  {submitError ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                      {submitError}
                    </div>
                  ) : null}

                  {submitSuccess ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                      {submitSuccess}
                    </div>
                  ) : null}

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-slate-600">
                      By submitting, you confirm the information is accurate and
                      consent to HR processing for recruitment.
                    </p>

                    <button
                      type="submit"
                      className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-orange-500/20 ring-1 ring-orange-400/30 transition hover:bg-orange-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
                      onClick={() => {
                        // Pre-emptively validate current selected file for instant feedback.
                        setFileError(validateResumeFile(resumeFile));
                      }}
                    >
                      Submit Application
                    </button>
                  </div>

                  <p className="pt-2 text-xs text-slate-500">
                    Security note (production): file uploads should be scanned
                    server-side and stored using least-privilege access.
                  </p>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer spacer */}
      <div className="bg-slate-950 py-10" />
    </main>
  );
}
