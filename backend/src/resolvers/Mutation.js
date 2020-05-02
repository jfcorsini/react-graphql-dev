const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Mutations = {
  async createItem(parent, args, ctx, info) {
    // TODO: Check if logged in

    const item = await ctx.db.mutation.createItem(
      {
        data: {
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

    // Create JWT
    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);

    // Set JWT as cookie in response
    ctx.response.cookie("token", token),
      {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
      };

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

    const token = jwt.sign({ userId: user.id }, process.env.APP_SECRET);

    // Set JWT as cookie in response
    ctx.response.cookie("token", token),
      {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 365, // 1 year
      };

    // Return user
    return user;
  },
  async signOut(parent, args, ctx, info) {
    ctx.response.clearCookie("token");

    return { message: "Signed out" };
  },
};

module.exports = Mutations;
