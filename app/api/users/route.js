import { PrismaClient } from '../../generated/prisma/default.js'
const prisma = new PrismaClient();

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return Response.json(users);
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    const { name, email } = body;

    if (!name || !email) {
      return Response.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
      },
    });

    return Response.json(user, { status: 201 });
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}
