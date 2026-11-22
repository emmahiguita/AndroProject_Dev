param(
    [Parameter(Mandatory)] [string]$InstallerPath,
    [Parameter(Mandatory)] [string]$IconPath
)

$ErrorActionPreference = 'Stop'
$installer = (Get-Item -LiteralPath $InstallerPath).FullName
$icon = (Get-Item -LiteralPath $IconPath).FullName
if ((Get-AuthenticodeSignature -LiteralPath $installer).Status -ne 'NotSigned') {
    throw 'Apply the installer icon before Authenticode signing.'
}

if (-not ('AndroProject.InstallerIcon' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.IO;
using System.Runtime.InteropServices;

namespace AndroProject
{
    public static class InstallerIcon
    {
        private static readonly IntPtr Icon = (IntPtr)3;
        private static readonly IntPtr IconGroup = (IntPtr)14;
        private static readonly IntPtr IExpressIcon = (IntPtr)3000;
        private const ushort IExpressLanguage = 1033;

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern IntPtr LoadLibraryEx(string path, IntPtr file, uint flags);
        [DllImport("kernel32.dll")]
        private static extern bool FreeLibrary(IntPtr module);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern IntPtr FindResource(IntPtr module, IntPtr name, IntPtr type);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern IntPtr FindResourceEx(IntPtr module, IntPtr type, IntPtr name, ushort language);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern IntPtr BeginUpdateResource(string path, bool deleteExisting);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern bool UpdateResource(IntPtr update, IntPtr type, IntPtr name, ushort language,
            byte[] data, uint size);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern bool EndUpdateResource(IntPtr update, bool discard);

        public static void Apply(string installer, string iconPath)
        {
            byte[] icon = File.ReadAllBytes(iconPath);
            if (icon.Length < 6 || BitConverter.ToUInt16(icon, 0) != 0 || BitConverter.ToUInt16(icon, 2) != 1)
                throw new InvalidDataException("Expected an ICO file.");

            int count = BitConverter.ToUInt16(icon, 4);
            int directorySize = 6 + count * 16;
            if (count == 0 || directorySize > icon.Length)
                throw new InvalidDataException("The ICO directory is incomplete.");

            IntPtr[] ids = FindUnusedIds(installer, count);
            byte[] group = new byte[6 + count * 14];
            Buffer.BlockCopy(icon, 0, group, 0, 6);

            IntPtr update = BeginUpdateResource(installer, false);
            if (update == IntPtr.Zero)
                throw new Win32Exception();

            bool discard = true;
            try
            {
                for (int i = 0; i < count; i++)
                {
                    int entry = 6 + i * 16;
                    uint size = BitConverter.ToUInt32(icon, entry + 8);
                    uint offset = BitConverter.ToUInt32(icon, entry + 12);
                    if (size == 0 || offset < directorySize || (ulong)offset + size > (ulong)icon.Length)
                        throw new InvalidDataException("An ICO frame is out of bounds.");

                    byte[] image = new byte[size];
                    Buffer.BlockCopy(icon, (int)offset, image, 0, image.Length);
                    if (!UpdateResource(update, Icon, ids[i], IExpressLanguage, image, size))
                        throw new Win32Exception();

                    int groupEntry = 6 + i * 14;
                    Buffer.BlockCopy(icon, entry, group, groupEntry, 12);
                    byte[] id = BitConverter.GetBytes((ushort)ids[i].ToInt32());
                    Buffer.BlockCopy(id, 0, group, groupEntry + 12, id.Length);
                }

                if (!UpdateResource(update, IconGroup, IExpressIcon, IExpressLanguage, group, (uint)group.Length))
                    throw new Win32Exception();
                discard = false;
            }
            finally
            {
                if (!EndUpdateResource(update, discard) && !discard)
                    throw new Win32Exception();
            }
        }

        private static IntPtr[] FindUnusedIds(string installer, int count)
        {
            // Inspect the resources without executing the installer or loading its dependencies.
            const uint LoadAsDataFileAndImageResource = 0x22;
            IntPtr module = LoadLibraryEx(installer, IntPtr.Zero, LoadAsDataFileAndImageResource);
            if (module == IntPtr.Zero)
                throw new Win32Exception();

            try
            {
                if (FindResourceEx(module, IconGroup, IExpressIcon, IExpressLanguage) == IntPtr.Zero)
                    throw new InvalidDataException("The IExpress installer icon group was not found.");

                IntPtr[] ids = new IntPtr[count];
                int used = 0;
                for (int id = 4000; id <= ushort.MaxValue && used < count; id++)
                {
                    if (FindResource(module, (IntPtr)id, Icon) == IntPtr.Zero)
                        ids[used++] = (IntPtr)id;
                }
                if (used != count)
                    throw new InvalidDataException("The installer has no free icon resource IDs.");
                return ids;
            }
            finally
            {
                FreeLibrary(module);
            }
        }
    }
}
'@
}

[AndroProject.InstallerIcon]::Apply($installer, $icon)
