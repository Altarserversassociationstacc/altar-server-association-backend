/**
 * Shared structural layout wrap for all system emails
 */
const baseLayout = (content) => `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e9e9e9; border-radius: 12px; color: #333; background-color: #ffffff;">
    <div style="text-align: center; border-bottom: 2px solid #8b4513; padding-bottom: 15px; margin-bottom: 20px;">
      <h2 style="color: #8b4513; margin: 0; font-size: 24px; letter-spacing: 0.5px;">Altar Server Association</h2>
    </div>
    ${content}
    <div style="text-align: center; margin-top: 40px; padding-top: 15px; border-top: 1px solid #e9e9e9; font-size: 12px; color: #a0a0a0;">
      <p style="margin: 5px 0;">This is an automated operational notification message.</p>
      <p style="margin: 5px 0;">&copy; 2026 Altar Server Association. All Rights Reserved.</p>
    </div>
  </div>
`;

exports.getAdminSignupTemplate = (user, approveLink) => baseLayout(`
  <h3 style="color: #d9534f; margin-top: 0;">New Registration Pending Review</h3>
  <p>Dear Administrator,</p>
  <p>A new member has completed the online signup form and requires administrative verification before system entry permissions are authorized:</p>
  <div style="background-color: #f8f9fa; padding: 15px; border-left: 4px solid #8b4513; border-radius: 4px; margin: 20px 0;">
    <p style="margin: 6px 0;"><strong>Full Name:</strong> ${user.fullName}</p>
    <p style="margin: 6px 0;"><strong>Email Account:</strong> ${user.email}</p>
  </div>
  <p>Review the application credentials and execute processing below:</p>
  <div style="text-align: center; margin: 35px 0;">
    <a href="${approveLink}" style="display: inline-block; padding: 13px 28px; background-color: #28a745; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">Approve Account Access</a>
  </div>
`);

exports.getStudentWelcomeTemplate = (fullName) => baseLayout(`
  <h3 style="color: #2b2b2b; margin-top: 0;">Application Received</h3>
  <p>Hello <strong>${fullName}</strong>,</p>
  <p>Your registration profile has been successfully generated inside the Altar Server Association portal framework.</p>
  <p><strong>Current Status:</strong> Pending Administrator Approvals.</p>
  <p>An confirmation email containing verification options will deploy immediately following administrative account authorization updates.</p>
`);

exports.getStudentVerificationTemplate = (code, magicLink) => baseLayout(`
  <h3 style="color: #2b2b2b; margin-top: 0;">Verify Your Email Profile</h3>
  <p>Please enter the 6-digit confirmation security token code inside your application console window interface:</p>
  <div style="text-align: center; margin: 30px 0;">
    <span style="font-size: 36px; font-weight: bold; letter-spacing: 6px; background-color: #f1f3f5; padding: 12px 28px; border-radius: 8px; border: 1px dashed #dee2e6; color: #2b2b2b;">${code}</span>
  </div>
  <p style="text-align: center; color: #777;">- OR -</p>
  <div style="text-align: center; margin: 30px 0;">
    <a href="${magicLink}" style="display: inline-block; padding: 13px 28px; background-color: #8b4513; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px;">Instant One-Click Verification</a>
  </div>
`);

exports.getCorrespondenceTemplate = (user, recipient, subject, message) => baseLayout(`
  <h3 style="color: #2b2b2b; margin-top: 0;">Official Outbound Dispatch</h3>
  <p style="font-size: 14px; margin: 4px 0;"><strong>Target Destination:</strong> ${recipient}</p>
  <p style="font-size: 14px; margin: 4px 0;"><strong>Sender Origin:</strong> ${user.fullName} (${user.regNo || 'N/A'})</p>
  <p style="font-size: 14px; margin: 4px 0;"><strong>Subject Thread:</strong> ${subject}</p>
  <div style="background-color: #fafafa; padding: 20px; border: 1px solid #eee; border-radius: 6px; margin: 20px 0; line-height: 1.6;">
    <p style="white-space: pre-wrap; margin: 0; font-size: 15px;">${message}</p>
  </div>
`);

exports.getForgotPasswordTemplate = (fullName, resetLink) => baseLayout(`
  <h3 style="color: #2b2b2b; margin-top: 0;">Security Access Link Reset</h3>
  <p>Hello <strong>${fullName}</strong>,</p>
  <p>An identity recovery request was recorded for your account portal access. Click below to update your password profile:</p>
  <div style="text-align: center; margin: 35px 0;">
    <a href="${resetLink}" style="display: inline-block; padding: 13px 28px; background-color: #8b4513; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px;">Reset Portal Password</a>
  </div>
  <p style="font-size: 13px; color: #666;">This single-use validation security link auto-expires in exactly 60 minutes.</p>
`);