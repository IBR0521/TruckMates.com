# How to Delete Old Site from Hostinger

## Step-by-Step Guide to Remove Old WordPress/SaaS Site

### Method 1: Using File Manager (Easiest - Recommended)

1. **Log in to Hostinger:**
   - Go to [hpanel.hostinger.com](https://hpanel.hostinger.com)
   - Log in with your account

2. **Open File Manager:**
   - In the left sidebar, find **"Files"** section
   - Click on **"File Manager"**
   - Or go to **"Websites"** → **"truckmateslogistic.com"** → **"File Manager"**

3. **Navigate to public_html:**
   - In File Manager, you'll see folders
   - Click on **"public_html"** folder (this is where your website files are)
   - This is the root directory of your website

4. **Select All Files:**
   - Click the checkbox at the top (selects all files and folders)
   - Or press `Ctrl+A` (Windows) / `Cmd+A` (Mac) to select all

5. **Delete Files:**
   - Click the **"Delete"** button (trash icon) at the top
   - Or right-click → **"Delete"**
   - Confirm the deletion when prompted

6. **Verify Deletion:**
   - The `public_html` folder should now be empty (or only have default files)
   - Your old site is now deleted

---

### Method 2: Delete Specific Folders Only

If you want to be more selective:

1. **Open File Manager** → **"public_html"**

2. **Delete WordPress files:**
   - Look for these folders/files and delete them:
     - `wp-admin/`
     - `wp-content/`
     - `wp-includes/`
     - `wp-config.php`
     - `index.php` (WordPress)
     - `.htaccess` (WordPress version)
     - Any other WordPress-related files

3. **Delete old SaaS files:**
   - Delete any folders/files from your old SaaS application
   - Look for custom folders you created

4. **Keep important files:**
   - Don't delete `.env` files if they have important configs
   - Don't delete any files you might need later

---

### Method 3: Using FTP (Alternative)

If you prefer using FTP:

1. **Get FTP credentials:**
   - In Hostinger hPanel → **"FTP Accounts"**
   - Note your FTP username, password, and server

2. **Connect via FTP client:**
   - Use FileZilla, WinSCP, or similar
   - Connect to your Hostinger FTP server

3. **Navigate to public_html:**
   - Go to `/public_html` directory

4. **Delete files:**
   - Select all files and folders
   - Delete them

---

## Important Notes

⚠️ **Before Deleting:**

1. **Backup First (Optional but Recommended):**
   - In File Manager, select all files
   - Click **"Compress"** → Create a ZIP file
   - Download the ZIP file to your computer
   - This way you can restore if needed

2. **Check for Important Data:**
   - Make sure you don't need any data from the old site
   - Export database if needed (if you have important data)

3. **Database (Optional):**
   - If you want to delete the database too:
     - Go to **"Databases"** in hPanel
     - Delete the old WordPress database (if you don't need it)

---

## After Deleting

Once you've deleted the old site:

1. **public_html folder is now empty** (or has default files)

2. **You can now:**
   - Upload your new Next.js app files
   - Or point your domain to Vercel (if using Vercel hosting)

3. **If using Vercel:**
   - You don't need to upload files to Hostinger
   - Just update DNS records to point to Vercel
   - The empty public_html won't matter

---

## Quick Checklist

- [ ] Log in to Hostinger hPanel
- [ ] Open File Manager
- [ ] Navigate to `public_html` folder
- [ ] (Optional) Backup files by creating ZIP
- [ ] Select all files and folders
- [ ] Click Delete
- [ ] Confirm deletion
- [ ] Verify `public_html` is empty
- [ ] (Optional) Delete old database if not needed

---

## Troubleshooting

### Can't Delete Some Files?

- **Permission issues:** Some files might be locked
- **Solution:** Try deleting one by one, or contact Hostinger support

### Accidentally Deleted Important Files?

- **Restore from backup:** If you created a ZIP backup, extract it
- **Contact Hostinger:** They might have automatic backups

### File Manager Not Loading?

- **Try different browser:** Clear cache and try again
- **Use FTP:** As an alternative method

---

## Next Steps After Deletion

1. **If deploying to Vercel:**
   - Deploy your Next.js app to Vercel
   - Point domain DNS to Vercel
   - No need to upload files to Hostinger

2. **If deploying to Hostinger:**
   - Upload your Next.js app files to `public_html`
   - Configure Node.js app
   - Set environment variables

---

**Ready to delete?** Follow Method 1 (File Manager) - it's the easiest! 🗑️

