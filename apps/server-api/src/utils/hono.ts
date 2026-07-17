import z from "zod";

export function honoDescribeRoute(tag: string, responseZod?: z.ZodSchema) {
  const responseSchema = responseZod ? (z.toJSONSchema(responseZod) as any) : {};
  return {
    tags: [tag],
    responses: {
      200: {
        description: "",
        content: {
          "text/plain": { schema: responseSchema },
        },
      },
    },
  };
}
