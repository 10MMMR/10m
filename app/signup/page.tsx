"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AuthCheckLoadingScreen } from "../_global/authentication/auth-check-loading-screen";
import { useAuth } from "../_global/authentication/auth-context";
import { SignedInAuthPanel } from "../_global/authentication/signed-in-auth-panel";
import { supabase } from "../_global/authentication/supabaseClient";

type SignupErrors = {
  email?: string;
  form?: string;
  name?: string;
  password?: string;
  repeatPassword?: string;
};

const SPECIAL_CHARACTER_PATTERN = /[^A-Za-z0-9]/;
const UPPERCASE_PATTERN = /[A-Z]/;

function hasPasswordRequirements(password: string) {
  return (
    password.length >= 6 &&
    UPPERCASE_PATTERN.test(password) &&
    SPECIAL_CHARACTER_PATTERN.test(password)
  );
}

function getOtpErrorMessage(message: string | undefined) {
  const normalized = message?.toLowerCase() ?? "";

  if (
    normalized.includes("invalid") ||
    normalized.includes("token") ||
    normalized.includes("otp")
  ) {
    return "Incorrect one-time passcode. Please try again.";
  }

  return message || "Unable to verify one-time passcode.";
}

function validateSignupFields({
  email,
  name,
  password,
  repeatPassword,
}: {
  email: string;
  name: string;
  password: string;
  repeatPassword: string;
}) {
  const errors: SignupErrors = {};

  if (!name.trim()) {
    errors.name = "Name is required.";
  }

  if (!email.trim()) {
    errors.email = "Email is required.";
  }

  if (!password) {
    errors.password = "Password is required.";
  } else if (!hasPasswordRequirements(password)) {
    errors.password = "Password does not meet all requirements.";
  }

  if (!repeatPassword) {
    errors.repeatPassword = "Please repeat your password.";
  } else if (repeatPassword !== password) {
    errors.repeatPassword = "Passwords must match exactly.";
  }

  return errors;
}

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [errors, setErrors] = useState<SignupErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const { isAuthenticated, signInWithGoogle, signOut, status, user } = useAuth();

  const hasMinLength = password.length >= 6;
  const hasUppercase = UPPERCASE_PATTERN.test(password);
  const hasSpecialCharacter = SPECIAL_CHARACTER_PATTERN.test(password);

  const canSubmit = !isSubmitting;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setHasSubmitted(true);

    const nextErrors = validateSignupFields({
      name,
      email,
      password,
      repeatPassword,
    });

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    if (!supabase) {
      setErrors({
        form: "Sign up is unavailable right now. Please try again later.",
      });
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const normalizedEmail = email.trim();
      const trimmedName = name.trim();

      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
          data: {
            name: trimmedName,
          },
        },
      });

      if (error) {
        setErrors({
          form: error.message || "Unable to start email verification.",
        });
        return;
      }

      setOtpEmail(normalizedEmail);
      setOtpCode("");
      setOtpError("");
    } catch {
      setErrors({
        form: "Unable to create your account right now. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!otpEmail || !supabase || isVerifyingOtp) {
      return;
    }

    const normalizedCode = otpCode.trim();

    if (!normalizedCode) {
      setOtpError("One-time passcode is required.");
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError("");

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: otpEmail,
        token: normalizedCode,
        type: "email",
      });

      if (error) {
        setOtpError(getOtpErrorMessage(error.message));
        return;
      }

      if (!data.session) {
        setOtpError("Unable to create a signed-in session from the passcode.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: {
          name: name.trim(),
        },
      });

      if (updateError) {
        setOtpError(updateError.message || "Unable to finish account setup.");
        return;
      }

      router.push("/app");
    } catch {
      setOtpError("Unable to verify one-time passcode right now. Please try again.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  if (status === "loading") {
    return <AuthCheckLoadingScreen />;
  }

  if (isAuthenticated && user) {
    return <SignedInAuthPanel onSignOut={signOut} user={user} />;
  }

  if (otpEmail) {
    return (
      <main className="flex h-[100dvh] items-center justify-center px-4 py-14 sm:px-6">
        <section className="organic-card w-full max-w-xl rounded-4xl p-6 sm:p-9">
          <p className="mono-label text-xs font-semibold uppercase tracking-[0.14em] text-(--text-muted)">
            Verify Email
          </p>
          <h1 className="display-font mt-3 text-4xl font-bold text-(--text-main)">
            Enter one-time passcode
          </h1>
          <p className="mt-3 text-(--text-muted)">
            We sent a one-time passcode to <span className="font-semibold text-(--text-main)">{otpEmail}</span>.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleVerifyOtp} noValidate>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-(--text-main)" htmlFor="signup-otp">
                One-time passcode
              </label>
              <input
                id="signup-otp"
                className="organic-input"
                name="otp"
                type="text"
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value)}
              />
            </div>

            {otpError ? <p className="text-sm text-(--destructive)">{otpError}</p> : null}

            <button
              disabled={isVerifyingOtp}
              className="organic-button organic-button-primary mt-1 min-h-12 w-full disabled:pointer-events-none disabled:opacity-60"
              type="submit"
            >
              {isVerifyingOtp ? "Verifying..." : "Verify and continue"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="flex h-[100dvh] items-center justify-center px-4 py-14 sm:px-6">
      <section className="organic-card w-full max-w-xl rounded-4xl p-6 sm:p-9">
        <p className="mono-label text-xs font-semibold uppercase tracking-[0.14em] text-(--text-muted)">
          Account Setup
        </p>
        <h1 className="display-font mt-3 text-4xl font-bold text-(--text-main)">Create account</h1>
        <p className="mt-3 text-(--text-muted)">
          Create an account to continue, then verify your email with a one-time passcode.
        </p>

        <button
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-full border border-(--border-soft) bg-(--surface-panel) px-5 py-3 font-semibold text-(--text-main) transition-colors duration-200 hover:bg-(--surface-main-soft)"
          type="button"
          onClick={signInWithGoogle}
          disabled={status === "unavailable"}
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-(--border-soft) bg-(--surface-base) text-sm font-bold text-(--main)">
            G
          </span>
          Sign up with Google
        </button>

        <div className="mt-5 flex items-center gap-3 text-xs uppercase tracking-[0.12em] text-(--text-muted)">
          <span className="h-px flex-1 bg-(--border-soft)" />
          <span>Or continue with email</span>
          <span className="h-px flex-1 bg-(--border-soft)" />
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit} noValidate>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-(--text-main)" htmlFor="signup-name">
              Name
            </label>
            <input
              id="signup-name"
              className="organic-input"
              name="name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            {errors.name ? <p className="text-sm text-(--destructive)">{errors.name}</p> : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-(--text-main)" htmlFor="signup-email">
              Email
            </label>
            <input
              id="signup-email"
              className="organic-input"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            {errors.email ? <p className="text-sm text-(--destructive)">{errors.email}</p> : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-(--text-main)" htmlFor="signup-password">
              Password
            </label>
            <input
              id="signup-password"
              className="organic-input"
              name="password"
              aria-invalid={Boolean(errors.password)}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <ul className="list-disc space-y-1 pl-5 text-xs text-(--text-muted)">
              <li className={hasMinLength ? "text-(--text-main)" : undefined}>
                At least 6 characters
              </li>
              <li className={hasUppercase ? "text-(--text-main)" : undefined}>
                At least one uppercase letter
              </li>
              <li className={hasSpecialCharacter ? "text-(--text-main)" : undefined}>
                At least one special character
              </li>
            </ul>
            {errors.password ? <p className="text-sm text-(--destructive)">{errors.password}</p> : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-(--text-main)" htmlFor="signup-repeat-password">
              Repeat password
            </label>
            <input
              id="signup-repeat-password"
              aria-invalid={hasSubmitted && Boolean(errors.repeatPassword)}
              className="organic-input"
              name="repeatPassword"
              type="password"
              value={repeatPassword}
              onChange={(event) => setRepeatPassword(event.target.value)}
            />
            {hasSubmitted && errors.repeatPassword ? (
              <p className="text-sm text-(--destructive)">{errors.repeatPassword}</p>
            ) : null}
          </div>

          {errors.form ? <p className="text-sm text-(--destructive)">{errors.form}</p> : null}

          <button
            disabled={!canSubmit}
            className="organic-button organic-button-primary mt-1 min-h-12 w-full disabled:pointer-events-none disabled:opacity-60"
            type="submit"
          >
            {isSubmitting ? "Creating account..." : "Submit"}
          </button>
        </form>

        <p className="mt-6 text-sm text-(--text-muted)">
          Already have an account?{" "}
          <Link className="font-semibold text-(--main) transition-colors hover:text-(--text-secondary)" href="/login">
            Log in
          </Link>
        </p>
      </section>
    </main>
  );
}
