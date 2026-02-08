import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const deleteAccountSchema = z.object({
  password: z.string().min(1, "Password is required"),
  confirmText: z.literal("DELETE", {
    errorMap: () => ({ message: "Confirmation text must be 'DELETE'" }),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { password, confirmText } = deleteAccountSchema.parse(body);

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        ownedTeams: true,
      },
    });

    if (!user || !user.password) {
      return NextResponse.json(
        { error: "User not found or password authentication not available" },
        { status: 404 }
      );
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 400 }
      );
    }

    // Warn if user owns teams
    if (user.ownedTeams.length > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete account: You own teams. Please transfer ownership or delete teams first.",
          ownedTeamsCount: user.ownedTeams.length,
        },
        { status: 400 }
      );
    }

    // Delete user (cascading deletes will handle related data)
    await prisma.user.delete({
      where: { id: user.id },
    });

    return NextResponse.json(
      { message: "Account deleted successfully" },
      { status: 200 }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Delete account error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete account" },
      { status: 500 }
    );
  }
}
