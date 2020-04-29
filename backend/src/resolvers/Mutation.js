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
};

module.exports = Mutations;
