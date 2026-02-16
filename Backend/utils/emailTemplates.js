// utils/emailTemplates.js

export const generateEmailTemplate = (action, userName = 'User') => {
  const actions = {

    signup: {
      subject: 'Welcome to Badal!',
      heading: 'Account Created Successfully',
      message: 'Thank you for signing up with Badal. Your account is now active!'
    },
    login: {
      subject: 'New Login Detected',
      heading: 'You’re Logged In',
      message: 'You recently logged in to your Badal account.'
    },
    delete: {
      subject: 'Account Deletion Notice',
      heading: 'Your Account Was Deleted',
      message: 'Your Badal account has been successfully deleted.'
    },


    'edit-profile': {
      subject: 'Profile Updated',
      heading: 'Your Profile Was Updated',
      message: 'You have successfully updated your personal information on Badal.'
    },
    'edit-org': {
      subject: 'Organization Updated',
      heading: 'Your Organization Was Updated',
      message: 'You have successfully updated your organization details on Badal.'
    },
    'edit-repo': {
      subject: 'Repository Updated',
      heading: 'Your Repository Was Updated',
      message: 'You have successfully updated repository metadata on Badal.'
    },
    'edit-project': {
      subject: 'Project Updated',
      heading: 'Your Project Was Updated',
      message: 'You have successfully updated your project details on Badal.'
    },
    // In emailTemplates.js
'form-submitted': {
  subject: 'Your Badal Profile is Now Complete!',
  heading: 'Thank You for Updating Your Profile',
  message: `
    Your information has been successfully saved.<br>
    You are now part of the Badal community dashboard.<br><br>
    <strong>Next step:</strong> You can log in anytime at 
    <a href="https://pl-app.iiit.ac.in/c4gt/signin" style="color:#1E4DD8; text-decoration:underline;">
      https://pl-app.iiit.ac.in/c4gt/signin
    </a>
  `
},

    // === Fallback (generic edit) ===
    edit: {
      subject: 'Update Successful',
      heading: 'Your Information Was Updated',
      message: 'You have successfully updated your information on Badal.'
    }
    
  };
  

  const { subject, heading, message } = actions[action] || actions.edit;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
  <title>${subject}</title>
</head>
<body style="margin:0; padding:0; font-family: Arial, sans-serif; background-color: #f5f7fa;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f7fa; padding: 20px;">
    <tr>
      <td align="center">
        <!-- Main Container -->
        <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
          <!-- Logo Header -->
          <tr>
            <td align="center" style="padding: 30px 20px 20px;">
              <!-- Inline Images side by side -->
              <table>
                <tr>
                  <td style="padding-right: 20px;">
                    <img 
                      src="https://pl-app.iiit.ac.in/rcts/codeforgovtech/static/media/badal_logo.0761a6013a4b149727f6.png" 
                      alt="Badal Logo" 
                      width="120" 
                      style="display: block; margin: 0 auto; border: 0;"
                    />
                  </td>
                  <td>
                    <img 
                      src="https://pl-app.iiit.ac.in/rcts/codeforgovtech/static/media/c4gt_logo.fff36ac1dfba8e030b95.jpeg" 
                      alt="C4GT Logo" 
                      width="120" 
                      style="display: block; margin: 0 auto; border: 0;"
                    />
                  </td>
                </tr>
              </table>
              <h1 style="color: #2c3e50; margin: 16px 0 8px; font-size: 24px;">${heading}</h1>
            </td>
          </tr>
          <!-- Message Body -->
          <tr>
            <td align="center" style="padding: 0 40px 30px; color: #34495e; font-size: 16px; line-height: 1.5;">
              <p style="margin: 0;">Hello ${userName},</p>
              <p style="margin: 16px 0 0;">${message}</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding: 20px; background-color: #f8f9fa; color: #7f8c8d; font-size: 14px; border-top: 1px solid #eee;">
              <p style="margin: 0;">© ${new Date().getFullYear()} RCTS@IIIT-H. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  return { subject, html };
};