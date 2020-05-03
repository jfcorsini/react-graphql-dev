const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { randomBytes } = require("crypto");
const { promisify } = require("util");
const { transport, requestTokenPassword } = require("../mail");

const setJwtToken = (user, ctx) => {
  // Create JWT
  const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);

  // Set JWT as cookie in response
  ctx.response.cookie("token", token),
    {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
    };
};

const Mutations = {
  async createItem(parent, args, ctx, info) {
    const userId = ctx.request.userId;
    if (!userId) {
      throw new Error("You must be logged in to create item");
    }

    const item = await ctx.db.mutation.createItem(
      {
        data: {
          // Creates a relationship between item and user
          user: {
            connect: {
              id: userId,
            },
          },
          ...args,
        },
      },
      info
    );

    return item;
  },
  updateItem(parent, args, ctx, info) {
    // TODO: Check if logged in

    const updates = { ...args };
    delete updates.id;

    return ctx.db.mutation.updateItem(
      {
        data: updates,
        where: {
          id: args.id,
        },
      },
      info
    );
  },
  async deleteItem(parent, args, ctx, info) {
    const where = {
      id: args.id,
    };

    // Find the item
    const item = await ctx.db.query.item({ where }, `{ id, title }`);

    // Check if it owns the item, or if it has permission
    // TODO

    // Delete it

    return ctx.db.mutation.deleteItem({ where }, info);
  },
  async signUp(parent, args, ctx, info) {
    args.email = args.email.toLowerCase();
    const password = await bcrypt.hash(args.password, 10);

    const user = await ctx.db.mutation.createUser(
      {
        data: {
          ...args,
          password,
          permissions: { set: ["USER"] },
        },
      },
      info
    );

    setJwtToken(user, ctx);

    // Return user
    return user;
  },
  async signIn(parent, { email, password }, ctx, info) {
    const user = await ctx.db.query.user({
      where: {
        email,
      },
    });

    if (!user) {
      throw new Error(`No user for email ${email}`);
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      throw new Error("Invalid password");
    }

    setJwtToken(user, ctx);

    // Return user
    return user;
  },
  async signOut(parent, args, ctx, info) {
    ctx.response.clearCookie("token");

    return { message: "Signed out" };
  },
  async requestReset(parent, { email }, ctx, info) {
    // Check if real user
    const user = await ctx.db.query.user({ where: { email } });
    if (!user) {
      throw new Error(`No user with email ${email}`);
    }

    // Set reset token and expiry
    const resetToken = (await promisify(randomBytes)(20)).toString("hex");
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour from now
    await ctx.db.mutation.updateUser({
      where: { email },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // Send email to reset
    const mailRes = await transport.sendMail({
      from: "jf.corsini@gmail.com",
      to: email,
      subject: "Your Password Reset Token",
      html: requestTokenPassword(resetToken),
    });

    return { message: "Reset sent" };
  },
  async resetPassword(parent, args, ctx, info) {
    const { resetToken, password, confirmPassword } = args;
    // Check if passwords match
    if (password !== confirmPassword) {
      throw new Error("Password does not match confirm password");
    }

    const [user] = await ctx.db.query.users({
      where: {
        resetToken,
        resetTokenExpiry_gte: Date.now(),
      },
    });

    // Check if legit reset token
    if (!user) {
      throw new Error("Token not found or expired");
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update user password and reset token fields
    const updatedUser = await ctx.db.mutation.updateUser(
      {
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExpiry: null,
        },
      },
      info
    );

    // Generate JWT
    setJwtToken(user, ctx);

    // Return new user
    return updatedUser;
  },
};

module.exports = Mutations;
