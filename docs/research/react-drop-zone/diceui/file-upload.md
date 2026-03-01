
# File Upload
URL: /docs/components/radix/file-upload



<ComponentTabs name="file-upload-demo" align="start" className="p-8" />

Installation [#installation]

CLI [#cli]

<CodeBlockTabs defaultValue="npm" groupId="package-manager" persist>
  <CodeBlockTabsList>
    <CodeBlockTabsTrigger value="npm">
      npm
    </CodeBlockTabsTrigger>

    <CodeBlockTabsTrigger value="pnpm">
      pnpm
    </CodeBlockTabsTrigger>

    <CodeBlockTabsTrigger value="yarn">
      yarn
    </CodeBlockTabsTrigger>

    <CodeBlockTabsTrigger value="bun">
      bun
    </CodeBlockTabsTrigger>
  </CodeBlockTabsList>

  <CodeBlockTab value="npm">
    ```bash
    npx shadcn@latest add @diceui/file-upload
    ```
  </CodeBlockTab>

  <CodeBlockTab value="pnpm">
    ```bash
    pnpm dlx shadcn@latest add @diceui/file-upload
    ```
  </CodeBlockTab>

  <CodeBlockTab value="yarn">
    ```bash
    yarn dlx shadcn@latest add @diceui/file-upload
    ```
  </CodeBlockTab>

  <CodeBlockTab value="bun">
    ```bash
    bun x shadcn@latest add @diceui/file-upload
    ```
  </CodeBlockTab>
</CodeBlockTabs>

Manual [#manual]

<Steps>
  <Step>
    Install the following dependencies:

    <CodeBlockTabs defaultValue="npm" groupId="package-manager" persist>
      <CodeBlockTabsList>
        <CodeBlockTabsTrigger value="npm">
          npm
        </CodeBlockTabsTrigger>

        <CodeBlockTabsTrigger value="pnpm">
          pnpm
        </CodeBlockTabsTrigger>

        <CodeBlockTabsTrigger value="yarn">
          yarn
        </CodeBlockTabsTrigger>

        <CodeBlockTabsTrigger value="bun">
          bun
        </CodeBlockTabsTrigger>
      </CodeBlockTabsList>

      <CodeBlockTab value="npm">
        ```bash
        npm install @radix-ui/react-slot
        ```
      </CodeBlockTab>

      <CodeBlockTab value="pnpm">
        ```bash
        pnpm add @radix-ui/react-slot
        ```
      </CodeBlockTab>

      <CodeBlockTab value="yarn">
        ```bash
        yarn add @radix-ui/react-slot
        ```
      </CodeBlockTab>

      <CodeBlockTab value="bun">
        ```bash
        bun add @radix-ui/react-slot
        ```
      </CodeBlockTab>
    </CodeBlockTabs>
  </Step>

  <Step>
    Copy and paste the following hook into your `hooks` directory.

    <ComponentSource name="use-lazy-ref" />
  </Step>

  <Step>
    Copy and paste the following code into your project.

    <ComponentSource name="file-upload" />
  </Step>

  <Step>
    Update the import paths to match your project setup.
  </Step>
</Steps>

Layout [#layout]

Import the parts, and compose them together.

```tsx
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadTrigger,
  FileUploadList,
  FileUploadItem,
  FileUploadItemPreview,
  FileUploadItemMetadata,
  FileUploadItemProgress,
  FileUploadItemDelete,
  FileUploadClear,
} from "@/components/ui/file-upload";

return (
  <FileUpload>
    <FileUploadDropzone />
    <FileUploadTrigger />
    <FileUploadList>
      <FileUploadItem>
        <FileUploadItemPreview />
        <FileUploadItemMetadata />
        <FileUploadItemProgress />
        <FileUploadItemDelete />
      </FileUploadItem>
    </FileUploadList>
    <FileUploadClear />
  </FileUpload>
)
```

Examples [#examples]

With Validation [#with-validation]

Validate files with the `onFileValidate` prop on the `Root` component based on type, size, and custom rules. This will override the default file rejection message.

<ComponentTabs name="file-upload-validation-demo" align="start" className="p-8" />

Direct Upload [#direct-upload]

Upload files directly with the `onUpload` prop on the `Root` component.

<ComponentTabs name="file-upload-direct-upload-demo" align="start" className="p-8" />

Circular Progress [#circular-progress]

Render a circular progress indicator instead of a linear one by enabling the `circular` prop on the `ItemProgress` component.

<ComponentTabs name="file-upload-circular-progress-demo" align="start" />

Fill Progress [#fill-progress]

Render a fill progress indicator instead of a linear one by enabling the `fill` prop on the `ItemProgress` component.

<ComponentTabs name="file-upload-fill-progress-demo" align="start" />

With uploadthing [#with-uploadthing]

Integrate with [uploadthing](https://uploadthing.com) for secure, type-safe file uploads with real-time progress tracking.

<ComponentTabs name="file-upload-uploadthing-demo" align="start" className="p-8" />

With Chat Input [#with-chat-input]

Integrate into a chat input for uploading files. For demo the `Dropzone` is absolutely positioned to cover the entire viewport.

<ComponentTabs name="file-upload-chat-input-demo" align="start" fullPreview />

With Form [#with-form]

Use the `value` and `onValueChange` props to handle file uploads with validation and submission.

<ComponentTabs name="file-upload-form-demo" align="start" className="p-8" />

API Reference [#api-reference]

FileUpload [#fileupload]

The main container component for the file upload functionality.

<AutoTypeTable path="./types/docs/file-upload.ts" name="FileUploadProps" />

FileUploadDropzone [#fileuploaddropzone]

A container for drag and drop functionality.

<AutoTypeTable path="./types/docs/file-upload.ts" name="FileUploadDropzoneProps" />

<DataAttributesTable
  data={[
  {
    title: "[data-disabled]",
    value: "Present when the dropzone is disabled.",
  },
  {
    title: "[data-dragging]",
    value: "Present when files are being dragged over the dropzone.",
  },
  {
    title: "[data-invalid]",
    value: "Present when there was an error with the files being uploaded.",
  },
]}
/>

FileUploadTrigger [#fileuploadtrigger]

A button that opens the file selection dialog.

<AutoTypeTable path="./types/docs/file-upload.ts" name="FileUploadTriggerProps" />

<DataAttributesTable
  data={[
  {
    title: "[data-disabled]",
    value: "Present when the trigger is disabled.",
  }
]}
/>

FileUploadList [#fileuploadlist]

A container for displaying uploaded files.

<AutoTypeTable path="./types/docs/file-upload.ts" name="FileUploadListProps" />

<DataAttributesTable
  data={[
  {
    title: "[data-orientation]",
    value: ["horizontal", "vertical"],
  },
  {
    title: "[data-state]",
    value: ["active", "inactive"],
  },
]}
/>

FileUploadItem [#fileuploaditem]

Individual file item component.

<AutoTypeTable path="./types/docs/file-upload.ts" name="FileUploadItemProps" />

FileUploadItemPreview [#fileuploaditempreview]

Displays a preview of the file, showing an image for image files or an appropriate icon for other file types.

<AutoTypeTable path="./types/docs/file-upload.ts" name="FileUploadItemPreviewProps" />

FileUploadItemMetadata [#fileuploaditemmetadata]

Displays file information such as name, size, and error messages.

<AutoTypeTable path="./types/docs/file-upload.ts" name="FileUploadItemMetadataProps" />

FileUploadItemProgress [#fileuploaditemprogress]

Shows the upload progress for a file.

<AutoTypeTable path="./types/docs/file-upload.ts" name="FileUploadItemProgressProps" />

FileUploadItemDelete [#fileuploaditemdelete]

A button to remove a file from the list.

<AutoTypeTable path="./types/docs/file-upload.ts" name="FileUploadItemDeleteProps" />

FileUploadClear [#fileuploadclear]

A button to clear all files from the list.

<AutoTypeTable path="./types/docs/file-upload.ts" name="FileUploadClearProps" />

<DataAttributesTable
  data={[
  {
    title: "[data-disabled]",
    value: "Present when the clear button is disabled.",
  },
]}
/>

Accessibility [#accessibility]

Keyboard Interactions [#keyboard-interactions]

<KeyboardShortcutsTable
  data={[
  {
    keys: ["Enter", "Space"],
    description: "When focus is on the dropzone or trigger, opens the file selection dialog.",
  },
  {
    keys: ["Tab"],
    description: "Moves focus between the dropzone, trigger, and file delete buttons.",
  },
  {
    keys: ["Shift + Tab"],
    description: "When the dropzone is focused, moves focus away from the dropzone.",
  },
]}
/>

Credits [#credits]

* [Building a Hold to Delete Component](https://emilkowal.ski/ui/building-a-hold-to-delete-component) - For the fill progress indicator.
