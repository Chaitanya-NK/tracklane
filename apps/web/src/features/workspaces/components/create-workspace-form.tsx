"use client";

import { slugify, workspaceNameSchema, workspaceSlugSchema } from "@tracklane/core";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAction } from "next-safe-action/hooks";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { createWorkspaceAction } from "../server/actions";
import { Spinner } from "@/components/ui/spinner";

const schema = z.object({ name: workspaceNameSchema, slug: workspaceSlugSchema });

export function CreateWorkspaceForm({ host }: { host: string }) {
  const [slugEdited, setSlugEdited] = useState(false);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", slug: "" },
  });
  const { executeAsync, result } = useAction(createWorkspaceAction);

  async function onSubmit(values: z.infer<typeof schema>) {
    const res = await executeAsync(values);
    if (res?.serverError?.field === "slug")
      form.setError("slug", { message: res.serverError.message });
  }

  const serverError =
    result.serverError && !result.serverError.field ? result.serverError.message : null;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {serverError ? (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        ) : null}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Workspace name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Acme Labs"
                  autoFocus
                  {...field}
                  onChange={(event) => {
                    field.onChange(event);
                    if (!slugEdited) {
                      form.setValue("slug", slugify(event.target.value).slice(0, 40), {
                        shouldValidate: form.formState.isSubmitted,
                      });
                    }
                  }}
                />
              </FormControl>
              <FormDescription>Usually your company or team name.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Workspace URL</FormLabel>
              <InputGroup>
                <InputGroupAddon>
                  <InputGroupText>{host}/</InputGroupText>
                </InputGroupAddon>
                <FormControl>
                  <InputGroupInput
                    className="pl-0.5"
                    placeholder="acme-labs"
                    {...field}
                    onChange={(event) => {
                      setSlugEdited(true);
                      field.onChange(event.target.value.toLowerCase());
                    }}
                  />
                </FormControl>
              </InputGroup>
              <FormDescription>Lowercase letters, numbers and hyphens.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <Spinner /> : null}
          Create workspace
        </Button>
      </form>
    </Form>
  );
}
