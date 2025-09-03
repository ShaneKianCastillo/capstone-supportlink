import Swal from 'sweetalert2'

export function loginSuccessful(){
    Swal.fire("Login Successful", "You have successfully logged in!", "success");
}

export function loginFailed(){
    Swal.fire("Login Failed", "Please check your credentials and try again.", "error");
}

export function incompleteForm(){
    Swal.fire("Incomplete Form", "Please fill in all required fields.", "warning");  
}

export function reportSubmitted(){
    Swal.fire("Report Submitted", "Your report is successfully submitted!", "success");  
}

export function profileUpdated(){
    Swal.fire("Profile Updated", "Your profile is successfully updated!", "success");  
}

// Change Password Alerts
export function passwordMismatch(){
    Swal.fire("Password Mismatch", "New Password and Confirm Password do not match.", "error");  
}



export function uniquePassword(){
    Swal.fire("New Password", "New Password must be different from Current Password.", "error");  
}

export function passwordLength(){
    Swal.fire("Password Characters", "New Password should be at least 6 characters.", "error");  
}

export function passwordUpdated(){
    Swal.fire("Password Updated", "Password updated successfully.", "success");  
}

export function passwordIncorrect(){
    Swal.fire("Password Incorrect", "Current password is incorrect.", "error");  
}

export function attemptOverload(){
    Swal.fire("Too many attempts", "Too many attempts. Please try again later.", "warning");  
}

export function loginRequires(){
    Swal.fire("Requires Logged in", "Please sign in again and retry.", "warning");  
}

export function changePasswordFailed(){
    Swal.fire("Change Password Failed", "Failed to update password. Please check the current password.", "error");  
}

//Add User Alerts
export function passNotMatched(){
    Swal.fire("Password Mismatch", "Passwords do not match!", "error");  
}

export function accountCreated(){
    Swal.fire("User Created", "User created successfully!", "success");  
}

