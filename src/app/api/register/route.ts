
import crypto from "crypto";

import { hash } from "bcrypt";
import { parsePhoneNumber } from "libphonenumber-js";
import { NextResponse } from "next/server";

import { supabase } from "@/lib/db";
import {
  sendEmail,
  getVerificationEmailContent,
} from "@/lib/emailService";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, phone, email, password } = body;

    if (
      !name?.trim() ||
      !phone?.trim() ||
      !email?.trim() ||
      !password
    ) {
      return NextResponse.json(
        { error: "Name, phone, email, and password are required" },
        { status: 400 }
      );
    }

    const lowerCaseEmail = email.trim().toLowerCase();

    let phoneNumber;
    try {
      // Include the country code, for example +216 for Tunisia.
      phoneNumber = parsePhoneNumber(phone.trim());

      if (!phoneNumber || !phoneNumber.isValid()) {
        return NextResponse.json(
          { error: "Invalid phone number. Include your country code." },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid phone number. Include your country code." },
        { status: 400 }
      );
    }

    const e164PhoneNumber = phoneNumber.format("E.164");

    // Check whether the email is already registered.
    const { data: existingEmail, error: emailCheckError } =
      await supabase
        .from("users")
          .select("id,is_verified")
        .eq("email", lowerCaseEmail)
        .maybeSingle();

    if (emailCheckError) {
      console.error("Email lookup failed:", emailCheckError);
      return NextResponse.json(
        { error: "Could not check email registration" },
        { status: 500 }
      );
    }

    if (existingEmail) {
      return NextResponse.json(
        existingEmail.is_verified
          ? { error: "Email already registered", type: "EMAIL_EXISTS" }
          : {
              error: "An account with this email is already registered but not verified.",
              type: "EMAIL_UNVERIFIED",
            },
        { status: 409 }
      );
    }

    // Check whether the phone number is already registered.
    const { data: existingPhone, error: phoneCheckError } =
      await supabase
        .from("users")
        .select("id")
        .eq("phone", e164PhoneNumber)
        .maybeSingle();

    if (phoneCheckError) {
      console.error("Phone lookup failed:", phoneCheckError);
      return NextResponse.json(
        { error: "Could not check phone registration" },
        { status: 500 }
      );
    }

    if (existingPhone) {
      return NextResponse.json(
        { error: "Phone number already registered", type: "PHONE_EXISTS" },
        { status: 409 }
      );
    }

    const hashedPassword = await hash(password, 10);

    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert({
        name: name.trim(),
        phone: e164PhoneNumber,
        email: lowerCaseEmail,
        password: hashedPassword,
        is_verified: false,
      })
      .select("id, name, phone, email")
      .single();

    if (insertError) {
      console.error("User insert failed:", insertError);
      if (insertError.code === "23505") {
        const duplicatePhone = /phone/i.test(insertError.message || "");
        return NextResponse.json(
          {
            error: duplicatePhone
              ? "Phone number already registered"
              : "Email already registered",
            type: duplicatePhone ? "PHONE_EXISTS" : "EMAIL_EXISTS",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "Could not create user. Check the database schema." },
        { status: 500 }
      );
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const { error: tokenError } = await supabase
      .from("email_verification_tokens")
      .insert({
        user_id: newUser.id,
        token,
        expires_at: expiresAt.toISOString(),
      });

    if (tokenError) {
      console.error("Verification token insert failed:", tokenError);
      return NextResponse.json(
        {
          error:
            "User created, but verification setup failed. Check the server logs.",
        },
        { status: 500 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!appUrl) {
      console.error("NEXT_PUBLIC_APP_URL is missing");
      return NextResponse.json(
        { error: "User created, but the application URL is not configured." },
        { status: 500 }
      );
    }

    const verificationUrl =
      `${appUrl.replace(/\/$/, "")}/verify-email?token=${token}`;

    const emailContent = getVerificationEmailContent(
      newUser.name,
      verificationUrl
    );

    try {
      await sendEmail(
        newUser.email,
        "Verify your email for RideShare",
        emailContent
      );
    } catch (emailError) {
      console.error("Verification email failed:", emailError);
      return NextResponse.json(
        {
          error:
            "User created, but the verification email could not be sent.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { user: newUser, message: "Verification email sent" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration API failed:", error);

    return NextResponse.json(
      { error: "Registration failed. Check the server terminal." },
      { status: 500 }
    );
  }
}
